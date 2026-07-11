export interface GpsPoint {
  lat: number;
  lng: number;
}

export interface LocalitySnapshot {
  city: string | null;
  region: string | null;
  country: string | null;
  dataset_version: string;
  resolution_source: 'embedded_gazetteer';
}

export interface GazetteerAttribution {
  name: string;
  license: string;
  url: string;
}

export interface GazetteerMetadata {
  version: string;
  attributions: GazetteerAttribution[];
}

export type BoundingBox = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number];
export type Ring = ReadonlyArray<readonly [lng: number, lat: number]>;

export interface AdministrativeArea {
  name: string;
  country: string | null;
  bounds: BoundingBox;
  rings: ReadonlyArray<Ring>;
}

export interface GazetteerCity extends GpsPoint {
  name: string;
  asciiName: string;
  alternateNames?: string[];
}

export interface GazetteerDataset {
  metadata: GazetteerMetadata;
  countries: AdministrativeArea[];
  regions: AdministrativeArea[];
  cities: GazetteerCity[];
}

export interface GazetteerSearchResult extends GazetteerCity {
  score: number;
}
