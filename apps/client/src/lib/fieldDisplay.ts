import type { ApiValue } from './apiTypes';

export interface GpsCoordinates {
  lat: number;
  lng: number;
}

export function parseGpsValue(value: ApiValue | undefined): GpsCoordinates | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const lat = normalizeCoordinate(value.lat);
  const lng = normalizeCoordinate(value.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng };
}

export function formatGpsValue(value: ApiValue | undefined): string | null {
  const coordinates = parseGpsValue(value);
  if (!coordinates) {
    return null;
  }

  return `${coordinates.lat}, ${coordinates.lng}`;
}

function normalizeCoordinate(value: ApiValue | undefined): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}
