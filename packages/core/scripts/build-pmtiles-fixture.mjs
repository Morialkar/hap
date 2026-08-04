/**
 * Builds the R3-A spike's offline map fixture.
 *
 * Source is the Natural Earth country geometry already bundled for the gazetteer
 * (public domain, so the archive is redistributable). Nothing is fetched: the spike
 * must prove the map renders with no network at all, which rules out OSM tile
 * prefetching or pulling a third-party basemap.
 *
 * Output is a PMTiles v3 archive of Mapbox Vector Tiles. The v3 container is written
 * here rather than shelled out to tippecanoe/pmtiles so the fixture can be rebuilt
 * from a clean checkout with nothing but pnpm.
 *
 * Usage: node scripts/build-pmtiles-fixture.mjs
 */
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const geojsonvt = require("geojson-vt").default ?? require("geojson-vt");
const vtpbf = require("vt-pbf");

const MAX_ZOOM = 4;
const LAYER_NAME = "countries";
const OUT_PATH = path.resolve(
  import.meta.dirname,
  "../../../apps/client/public/fixtures/r3a-countries.pmtiles",
);

/** PMTiles v3 encodes tile coordinates as a Hilbert curve index. */
function zxyToTileId(z, x, y) {
  if (z === 0) return 0n;
  let acc = 0n;
  for (let t = 0; t < z; t++) {
    acc += (1n << BigInt(t)) * (1n << BigInt(t));
  }
  const n = 1n << BigInt(z);
  let rx = 0n;
  let ry = 0n;
  let d = 0n;
  let bx = BigInt(x);
  let by = BigInt(y);
  for (let s = n / 2n; s > 0n; s /= 2n) {
    rx = (bx & s) > 0n ? 1n : 0n;
    ry = (by & s) > 0n ? 1n : 0n;
    d += s * s * ((3n * rx) ^ ry);
    // rotate
    if (ry === 0n) {
      if (rx === 1n) {
        bx = s - 1n - bx;
        by = s - 1n - by;
      }
      const tmp = bx;
      bx = by;
      by = tmp;
    }
  }
  return acc + d;
}

function writeVarint(value) {
  const bytes = [];
  let v = BigInt(value);
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return Buffer.from(bytes);
}

/** Directory serialization per the PMTiles v3 spec: four delta-encoded varint blocks. */
function serializeDirectory(entries) {
  const parts = [writeVarint(entries.length)];

  let lastId = 0n;
  for (const entry of entries) {
    parts.push(writeVarint(entry.tileId - lastId));
    lastId = entry.tileId;
  }
  for (const entry of entries) parts.push(writeVarint(entry.runLength));
  for (const entry of entries) parts.push(writeVarint(entry.length));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const previous = entries[i - 1];
    if (i > 0 && previous.offset + previous.length === entry.offset) {
      parts.push(writeVarint(0));
    } else {
      parts.push(writeVarint(entry.offset + 1n));
    }
  }

  return Buffer.concat(parts);
}

function buildHeader(fields) {
  const header = Buffer.alloc(127);
  header.write("PMTiles", 0, "ascii");
  header.writeUInt8(3, 7);
  header.writeBigUInt64LE(fields.rootOffset, 8);
  header.writeBigUInt64LE(fields.rootLength, 16);
  header.writeBigUInt64LE(fields.metadataOffset, 24);
  header.writeBigUInt64LE(fields.metadataLength, 32);
  header.writeBigUInt64LE(fields.leafOffset, 40);
  header.writeBigUInt64LE(fields.leafLength, 48);
  header.writeBigUInt64LE(fields.tileDataOffset, 56);
  header.writeBigUInt64LE(fields.tileDataLength, 64);
  header.writeBigUInt64LE(fields.addressedTiles, 72);
  header.writeBigUInt64LE(fields.tileEntries, 80);
  header.writeBigUInt64LE(fields.tileContents, 88);
  header.writeUInt8(0, 96); // not clustered by leaf directories
  header.writeUInt8(2, 97); // internal compression: gzip
  header.writeUInt8(2, 98); // tile compression: gzip
  header.writeUInt8(1, 99); // tile type: MVT
  header.writeUInt8(fields.minZoom, 100);
  header.writeUInt8(fields.maxZoom, 101);
  header.writeInt32LE(Math.round(fields.minLon * 1e7), 102);
  header.writeInt32LE(Math.round(fields.minLat * 1e7), 106);
  header.writeInt32LE(Math.round(fields.maxLon * 1e7), 110);
  header.writeInt32LE(Math.round(fields.maxLat * 1e7), 114);
  header.writeUInt8(fields.centerZoom, 118);
  header.writeInt32LE(Math.round(fields.centerLon * 1e7), 119);
  header.writeInt32LE(Math.round(fields.centerLat * 1e7), 123);
  return header;
}

async function main() {
  const { bundledGazetteerDataset } = await import("../src/gazetteer/data.ts");

  const features = bundledGazetteerDataset.countries.map((country) => ({
    type: "Feature",
    properties: { name: country.name },
    geometry: {
      type: "MultiPolygon",
      coordinates: country.rings.map((ring) => [
        ring.map(([lng, lat]) => [lng, lat]),
      ]),
    },
  }));

  console.log(`Tiling ${features.length} country features up to z${MAX_ZOOM}…`);

  const index = geojsonvt(
    { type: "FeatureCollection", features },
    { maxZoom: MAX_ZOOM, indexMaxZoom: MAX_ZOOM, buffer: 64 },
  );

  // Collect every non-empty tile, keyed by its Hilbert id so the directory is sorted.
  const tiles = [];
  for (let z = 0; z <= MAX_ZOOM; z++) {
    const side = 1 << z;
    for (let x = 0; x < side; x++) {
      for (let y = 0; y < side; y++) {
        const tile = index.getTile(z, x, y);
        if (!tile || tile.features.length === 0) continue;
        const buffer = Buffer.from(
          vtpbf.fromGeojsonVt({ [LAYER_NAME]: tile }, { version: 2 }),
        );
        if (buffer.length === 0) continue;
        tiles.push({ tileId: zxyToTileId(z, x, y), data: gzipSync(buffer) });
      }
    }
  }

  tiles.sort((a, b) =>
    a.tileId < b.tileId ? -1 : a.tileId > b.tileId ? 1 : 0,
  );
  console.log(`${tiles.length} non-empty tiles`);

  // Identical tiles (large empty ocean areas) are stored once and shared.
  const seen = new Map();
  const tileBlobs = [];
  const entries = [];
  let dataOffset = 0n;

  for (const tile of tiles) {
    const key = tile.data.toString("base64");
    let placement = seen.get(key);
    if (!placement) {
      placement = { offset: dataOffset, length: BigInt(tile.data.length) };
      seen.set(key, placement);
      tileBlobs.push(tile.data);
      dataOffset += BigInt(tile.data.length);
    }
    entries.push({
      tileId: tile.tileId,
      offset: placement.offset,
      length: placement.length,
      runLength: 1n,
    });
  }

  const metadata = Buffer.from(
    JSON.stringify({
      name: "HAP R3-A offline fixture",
      description:
        "Natural Earth country polygons, bundled for the R3-A Tauri spike offline map proof.",
      attribution: "Natural Earth (public domain)",
      vector_layers: [
        {
          id: LAYER_NAME,
          fields: { name: "String" },
          minzoom: 0,
          maxzoom: MAX_ZOOM,
        },
      ],
    }),
    "utf-8",
  );

  const rootDirectory = gzipSync(serializeDirectory(entries));
  const metadataGz = gzipSync(metadata);
  const tileData = Buffer.concat(tileBlobs);

  const rootOffset = 127n;
  const metadataOffset = rootOffset + BigInt(rootDirectory.length);
  const leafOffset = metadataOffset + BigInt(metadataGz.length);
  const tileDataOffset = leafOffset;

  const header = buildHeader({
    rootOffset,
    rootLength: BigInt(rootDirectory.length),
    metadataOffset,
    metadataLength: BigInt(metadataGz.length),
    leafOffset,
    leafLength: 0n,
    tileDataOffset,
    tileDataLength: BigInt(tileData.length),
    addressedTiles: BigInt(entries.length),
    tileEntries: BigInt(entries.length),
    tileContents: BigInt(tileBlobs.length),
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    minLon: -180,
    minLat: -85,
    maxLon: 180,
    maxLat: 85,
    centerZoom: 0,
    centerLon: 0,
    centerLat: 0,
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    Buffer.concat([header, rootDirectory, metadataGz, tileData]),
  );

  const size = fs.statSync(OUT_PATH).size;
  console.log(`Wrote ${OUT_PATH} (${(size / 1024).toFixed(1)} KiB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
