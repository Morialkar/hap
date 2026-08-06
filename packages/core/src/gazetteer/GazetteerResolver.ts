import type {
  AdministrativeArea,
  GazetteerCity,
  GazetteerDataset,
  GazetteerSearchResult,
  GpsPoint,
  LocalitySnapshot,
  Ring,
} from "./types";

const EARTH_RADIUS_KM = 6371;

export class GazetteerResolver {
  private readonly cityIndex: CityKdNode | null;
  private readonly dataset: GazetteerDataset;

  constructor(dataset: GazetteerDataset) {
    this.dataset = dataset;
    this.cityIndex = buildCityIndex(dataset.cities);
  }

  resolve(point: GpsPoint): LocalitySnapshot {
    assertPoint(point);
    const country =
      findContainingArea(this.dataset.countries, point)?.name ?? null;
    const region =
      findContainingArea(this.dataset.regions, point)?.name ?? null;
    const city = this.findNearestCity(point)?.name ?? null;

    return {
      city,
      region,
      country,
      dataset_version: this.dataset.metadata.version,
      resolution_source: "embedded_gazetteer",
    };
  }

  search(query: string, limit = 10): GazetteerSearchResult[] {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery || limit < 1) return [];

    return this.dataset.cities
      .map((city) => ({ city, score: searchScore(city, normalizedQuery) }))
      .filter((result) => result.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name),
      )
      .slice(0, limit)
      .map(({ city, score }) => ({ ...city, score }));
  }

  private findNearestCity(point: GpsPoint): GazetteerCity | null {
    if (!this.cityIndex) return null;
    return nearestCity(this.cityIndex, point, null)?.city ?? null;
  }
}

function assertPoint({ lat, lng }: GpsPoint) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new RangeError(
      "GPS coordinates must be within latitude -90..90 and longitude -180..180.",
    );
  }
}

function findContainingArea(
  areas: AdministrativeArea[],
  point: GpsPoint,
): AdministrativeArea | null {
  return (
    areas.find(
      (area) =>
        isWithinBounds(area.bounds, point) &&
        isPointInPolygon(area.rings, point),
    ) ?? null
  );
}

function isWithinBounds(
  [minLng, minLat, maxLng, maxLat]: AdministrativeArea["bounds"],
  point: GpsPoint,
) {
  return (
    point.lng >= minLng &&
    point.lng <= maxLng &&
    point.lat >= minLat &&
    point.lat <= maxLat
  );
}

function isPointInPolygon(rings: ReadonlyArray<Ring>, point: GpsPoint) {
  let inside = false;
  for (const ring of rings) {
    if (isPointOnRing(ring, point)) return true;
    if (isPointInRing(ring, point)) inside = !inside;
  }
  return inside;
}

function isPointInRing(ring: Ring, point: GpsPoint) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointOnRing(ring: Ring, point: GpsPoint) {
  for (let i = 1; i < ring.length; i++) {
    const [x1, y1] = ring[i - 1];
    const [x2, y2] = ring[i];
    const cross = (point.lng - x1) * (y2 - y1) - (point.lat - y1) * (x2 - x1);
    const within =
      point.lng >= Math.min(x1, x2) &&
      point.lng <= Math.max(x1, x2) &&
      point.lat >= Math.min(y1, y2) &&
      point.lat <= Math.max(y1, y2);
    if (Math.abs(cross) < 1e-10 && within) return true;
  }
  return false;
}

interface CityKdNode {
  city: GazetteerCity;
  axis: "lat" | "lng";
  left: CityKdNode | null;
  right: CityKdNode | null;
}
interface NearestCity {
  city: GazetteerCity;
  distance: number;
}

function buildCityIndex(cities: GazetteerCity[]): CityKdNode | null {
  const build = (values: GazetteerCity[], depth: number): CityKdNode | null => {
    if (!values.length) return null;
    const axis = depth % 2 === 0 ? "lat" : "lng";
    const sorted = [...values].sort((a, b) => a[axis] - b[axis]);
    const middle = Math.floor(sorted.length / 2);
    return {
      city: sorted[middle],
      axis,
      left: build(sorted.slice(0, middle), depth + 1),
      right: build(sorted.slice(middle + 1), depth + 1),
    };
  };
  return build(cities, 0);
}

function nearestCity(
  node: CityKdNode | null,
  point: GpsPoint,
  best: NearestCity | null,
): NearestCity | null {
  if (!node) return best;
  const distance = haversineKm(point, node.city);
  let nextBest: NearestCity | null =
    !best || distance < best.distance ? { city: node.city, distance } : best;
  const delta = point[node.axis] - node.city[node.axis];
  const near = delta < 0 ? node.left : node.right;
  const far = delta < 0 ? node.right : node.left;
  nextBest = nearestCity(near, point, nextBest);
  const axisDistance = Math.abs(delta) * 111.32;
  if (!nextBest || axisDistance <= nextBest.distance)
    nextBest = nearestCity(far, point, nextBest);
  return nextBest;
}

function haversineKm(a: GpsPoint, b: GpsPoint) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * radians) *
      Math.cos(b.lat * radians) *
      Math.sin(dLng / 2) ** 2;
  return (
    EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
}

function searchScore(city: GazetteerCity, query: string) {
  const names = [city.name, city.asciiName, ...(city.alternateNames ?? [])].map(
    normalize,
  );
  if (names.some((name) => name === query)) return 3;
  if (names.some((name) => name.startsWith(query))) return 2;
  return names.some((name) => name.includes(query)) ? 1 : 0;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}
