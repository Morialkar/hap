export { GazetteerResolver } from "./GazetteerResolver";
import { GazetteerResolver } from "./GazetteerResolver";

let bundledResolver: Promise<GazetteerResolver> | null = null;

export async function loadBundledGazetteer() {
  const { bundledGazetteerDataset } = await import("./data");
  return bundledGazetteerDataset;
}

export function loadBundledGazetteerResolver() {
  bundledResolver ??= loadBundledGazetteer().then(
    (dataset) => new GazetteerResolver(dataset),
  );
  return bundledResolver;
}
export type {
  AdministrativeArea,
  GazetteerAttribution,
  GazetteerCity,
  GazetteerDataset,
  GazetteerMetadata,
  GazetteerSearchResult,
  GpsPoint,
  LocalitySnapshot,
} from "./types";
