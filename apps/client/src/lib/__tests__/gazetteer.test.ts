import { describe, expect, test } from 'vitest';
import { GazetteerResolver, loadBundledGazetteer, type GazetteerDataset } from '@hap/core';

const dataset: GazetteerDataset = {
  metadata: { version: 'test-1', attributions: [] },
  countries: [
    {
      name: 'Canada',
      country: null,
      bounds: [-80, 40, -50, 70],
      rings: [
        [
          [-80, 40],
          [-50, 40],
          [-50, 70],
          [-80, 70],
          [-80, 40],
        ],
      ],
    },
  ],
  regions: [
    {
      name: 'Québec',
      country: 'Canada',
      bounds: [-80, 45, -55, 63],
      rings: [
        [
          [-80, 45],
          [-55, 45],
          [-55, 63],
          [-80, 63],
          [-80, 45],
        ],
      ],
    },
  ],
  cities: [
    { name: 'Montréal', asciiName: 'Montreal', lat: 45.5017, lng: -73.5673 },
    { name: 'Québec', asciiName: 'Quebec', lat: 46.8139, lng: -71.208 },
  ],
};

describe('GazetteerResolver', () => {
  test('records the embedded dataset version for an in-country point', () => {
    expect(new GazetteerResolver(dataset).resolve({ lat: 45.5017, lng: -73.5673 })).toEqual({
      city: 'Montréal',
      region: 'Québec',
      country: 'Canada',
      dataset_version: 'test-1',
      resolution_source: 'embedded_gazetteer',
    });
  });

  test('returns a null administrative snapshot for ocean points', () => {
    expect(new GazetteerResolver(dataset).resolve({ lat: 0, lng: -30 })).toMatchObject({
      country: null,
      region: null,
      dataset_version: 'test-1',
    });
  });

  test('includes border points and searches accent-insensitively', () => {
    const resolver = new GazetteerResolver(dataset);
    expect(resolver.resolve({ lat: 45, lng: -80 }).country).toBe('Canada');
    expect(resolver.search('montreal')).toMatchObject([{ name: 'Montréal', score: 3 }]);
  });

  test('ships versioned Natural Earth and GeoNames data', async () => {
    const bundled = await loadBundledGazetteer();
    expect(bundled.metadata.version).toBe('natural-earth-5.1.1-geonames-cities1000-2026-07-11');
    expect(bundled.metadata.attributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Natural Earth', license: 'Public domain' }),
        expect.objectContaining({ name: 'GeoNames', license: 'CC BY 4.0' }),
      ])
    );
    expect(new GazetteerResolver(bundled).resolve({ lat: 45.5017, lng: -73.5673 })).toMatchObject({
      country: 'Canada',
    });
  }, 30_000);
});
