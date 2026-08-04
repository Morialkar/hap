import { describe, it, expect } from 'vitest';
import { PMTiles, type Source, type RangeResponse } from 'pmtiles';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, '../../../public/fixtures/r3a-countries.pmtiles');

/** Serves the fixture from disk the way the browser serves it over range requests. */
class LocalFileSource implements Source {
  private readonly buffer: Buffer;

  constructor(file: string) {
    this.buffer = fs.readFileSync(file);
  }

  getKey(): string {
    return FIXTURE;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const slice = this.buffer.subarray(offset, offset + length);
    return {
      data: slice.buffer.slice(
        slice.byteOffset,
        slice.byteOffset + slice.byteLength
      ) as ArrayBuffer,
    };
  }
}

/**
 * The archive is written by packages/core/scripts/build-pmtiles-fixture.mjs, which
 * implements the PMTiles v3 container directly. These assertions are what stop a
 * malformed archive from reaching the spike, where it would look like a Tauri problem.
 */
describe('R3-A offline map fixture', () => {
  const archive = new PMTiles(new LocalFileSource(FIXTURE));

  it('is a valid PMTiles v3 archive of vector tiles', async () => {
    const header = await archive.getHeader();

    expect(header.tileType).toBe(1); // MVT
    expect(header.minZoom).toBe(0);
    expect(header.maxZoom).toBe(4);
    expect(header.numAddressedTiles).toBeGreaterThan(0);
    // Identical ocean tiles are deduplicated, so contents must not exceed entries.
    expect(header.numTileContents).toBeLessThanOrEqual(header.numAddressedTiles);
  });

  it('declares the layer the probe style renders', async () => {
    const metadata = (await archive.getMetadata()) as {
      vector_layers: { id: string }[];
      attribution: string;
    };

    expect(metadata.vector_layers.map((layer) => layer.id)).toContain('countries');
    // Redistributable by design: the spike must not embed OSM-derived basemap data.
    expect(metadata.attribution).toContain('Natural Earth');
  });

  it('returns tile data at every zoom level the style may request', async () => {
    for (let z = 0; z <= 4; z++) {
      const tile = await archive.getZxy(z, 0, 0);
      // z/0/0 is ocean at some zooms; what matters is that lookups resolve without error.
      expect(tile === undefined || tile.data.byteLength > 0).toBe(true);
    }

    // A tile that certainly covers land (North America at z2).
    const populated = await archive.getZxy(2, 1, 1);
    expect(populated?.data.byteLength).toBeGreaterThan(0);
  });

  it('stays small enough to ship inside the app bundle', () => {
    const sizeKiB = fs.statSync(FIXTURE).size / 1024;
    expect(sizeKiB).toBeLessThan(1024);
  });
});
