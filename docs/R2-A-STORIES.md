# R2-A GPS, Maps, and Gazetteer Story Split

R2-A should land contract-first, then progressively add map and gazetteer behavior.

## Story R2-A1 - GPS field type

Implement the `gps` field type in the schema registry and record form.

- API accepts and normalizes `{ lat, lng }` values.
- Validation enforces latitude `-90..90` and longitude `-180..180`.
- Empty values remain nullable.
- Client builder exposes the field type and records can be created with manual lat/lng entry.

## Story R2-A2 - Map picker editor

Replace the manual-only editor with a MapLibre GL picker while preserving manual entry.

- Drag pin updates `{ lat, lng }`.
- Manual entry updates the pin.
- No external geocoding service is used.

## Story R2-A3 - Embedded gazetteer package

Add the in-process resolver in `packages/core`.

- Natural Earth polygons provide country and region snapshots.
- GeoNames `cities1000` provides nearest-city labels and forward search.
- Dataset version and attribution are surfaced by the package.

## Story R2-A4 - Record point side table

Maintain a PostGIS-backed `record_points` table from GPS record data.

- Create/update/delete record writes keep the side table in sync.
- Filtering reuses the R1-C3 query path where possible.

## Story R2-A5 - Map browse and aggregation

Add a database map view with clustering and drill-down counts.

- Clustered points link back to records.
- Aggregations support country, region, and city.
- Counts match seeded fixtures.

## Story R2-A6 - Image EXIF location and privacy

Integrate EXIF handling with uploads and export/share flows.

- Share/export strips GPS and EXIF by default.
- Upload flow can fill a GPS field from photo coordinates when the user chooses it.
