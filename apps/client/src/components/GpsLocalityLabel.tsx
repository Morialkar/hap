import { useEffect, useState } from 'react';
import { loadBundledGazetteerResolver, type GpsPoint, type LocalitySnapshot } from '@hap/core';

export function GpsLocalityLabel({ coordinates }: { coordinates: GpsPoint }) {
  const [locality, setLocality] = useState<LocalitySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadBundledGazetteerResolver()
      .then((resolver) => {
        if (!cancelled) setLocality(resolver.resolve(coordinates));
      })
      .catch(() => {
        if (!cancelled) setLocality(null);
      });
    return () => {
      cancelled = true;
    };
  }, [coordinates.lat, coordinates.lng]);

  const label = [locality?.city, locality?.region, locality?.country].filter(Boolean).join(', ');
  return label ? <div className="text-muted small mt-2">{label}</div> : null;
}
