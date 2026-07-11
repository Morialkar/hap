import { describe, expect, it } from 'vitest';
import { formatGpsValue, parseGpsValue } from '../fieldDisplay';

describe('formatGpsValue', () => {
  it('formats gps coordinate objects', () => {
    expect(formatGpsValue({ lat: 45.5017, lng: -73.5673 })).toBe('45.5017, -73.5673');
  });

  it('formats string coordinate objects without coercing display precision', () => {
    expect(formatGpsValue({ lat: '45.5017', lng: '-73.5673' })).toBe('45.5017, -73.5673');
  });

  it('returns null for incomplete gps values', () => {
    expect(formatGpsValue({ lat: 45.5017 })).toBeNull();
    expect(formatGpsValue('45.5017, -73.5673')).toBeNull();
  });

  it('parses gps coordinate objects for map display', () => {
    expect(parseGpsValue({ lat: '45.5017', lng: '-73.5673' })).toEqual({
      lat: 45.5017,
      lng: -73.5673,
    });
  });
});
