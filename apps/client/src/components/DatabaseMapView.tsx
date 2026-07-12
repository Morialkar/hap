import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadBundledGazetteerResolver, type LocalitySnapshot } from '@hap/core';

export interface DatabaseMapPoint {
  record_id: string;
  table_id: string;
  table_name: string;
  field_name: string;
  latitude: number;
  longitude: number;
  record_title: string;
}

const style = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function DatabaseMapView({
  points,
  databaseId,
}: {
  points: DatabaseMapPoint[];
  databaseId: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [localities, setLocalities] = useState<Record<string, LocalitySnapshot>>({});
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<DatabaseMapPoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadBundledGazetteerResolver().then((resolver) => {
      if (cancelled) return;
      setLocalities(
        Object.fromEntries(
          points.map((point) => [
            pointKey(point),
            resolver.resolve({ lat: point.latitude, lng: point.longitude }),
          ])
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [points]);

  const countries = useMemo(
    () => unique(points.map((point) => localities[pointKey(point)]?.country)),
    [points, localities]
  );
  const regions = useMemo(
    () =>
      unique(
        points
          .filter((point) => !country || localities[pointKey(point)]?.country === country)
          .map((point) => localities[pointKey(point)]?.region)
      ),
    [points, localities, country]
  );
  const cities = useMemo(
    () =>
      unique(
        points
          .filter(
            (point) =>
              (!country || localities[pointKey(point)]?.country === country) &&
              (!region || localities[pointKey(point)]?.region === region)
          )
          .map((point) => localities[pointKey(point)]?.city)
      ),
    [points, localities, country, region]
  );
  const visiblePoints = useMemo(
    () =>
      points.filter((point) => {
        const locality = localities[pointKey(point)];
        return (
          (!country || locality?.country === country) &&
          (!region || locality?.region === region) &&
          (!city || locality?.city === city)
        );
      }),
    [points, localities, country, region, city]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let map: import('maplibre-gl').Map | null = null;
    void import('maplibre-gl')
      .then((maplibregl) => {
        map = new maplibregl.Map({
          container: containerRef.current!,
          style: style as maplibregl.StyleSpecification,
          center: [-73.5673, 45.5017],
          zoom: 4,
        });
        map.on('load', () => {
          map!.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
          map!.addSource('records', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: visiblePoints.map((point) => ({
                type: 'Feature' as const,
                properties: point,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [point.longitude, point.latitude],
                },
              })),
            },
            cluster: true,
            clusterRadius: 45,
          });
          map!.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'records',
            filter: ['has', 'point_count'],
            paint: { 'circle-color': '#2f6f4e', 'circle-radius': 20 },
          });
          map!.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'records',
            filter: ['has', 'point_count'],
            layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 },
            paint: { 'text-color': '#ffffff' },
          });
          map!.addLayer({
            id: 'record-points',
            type: 'circle',
            source: 'records',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': '#e83e78',
              'circle-radius': 7,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            },
          });
          map!.on('click', 'clusters', (event) => {
            const feature = event.features?.[0];
            const clusterId = feature?.properties?.cluster_id;
            const coordinates =
              feature?.geometry?.type === 'Point'
                ? (feature.geometry.coordinates as [number, number])
                : undefined;
            if (clusterId === undefined || !coordinates) return;
            void (map!.getSource('records') as import('maplibre-gl').GeoJSONSource)
              .getClusterExpansionZoom(Number(clusterId))
              .then((zoom) => map!.easeTo({ center: coordinates, zoom }));
          });
          map!.on('click', 'record-points', (event) => {
            const point = event.features?.[0]?.properties as DatabaseMapPoint | undefined;
            if (point) setSelectedPoint(point);
          });
        });
      })
      .catch(() => setUnavailable(true));
    return () => map?.remove();
  }, [visiblePoints]);

  if (unavailable) return <div className="alert alert-warning">Carte indisponible.</div>;
  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <select
            className="form-select"
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setRegion('');
              setCity('');
            }}
          >
            <option value="">Tous les pays ({points.length})</option>
            {countries.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={region}
            disabled={!country}
            onChange={(event) => {
              setRegion(event.target.value);
              setCity('');
            }}
          >
            <option value="">Toutes les régions</option>
            {regions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={city}
            disabled={!region}
            onChange={(event) => setCity(event.target.value)}
          >
            <option value="">Toutes les villes</option>
            {cities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-muted small">
        {visiblePoints.length} fiche{visiblePoints.length === 1 ? '' : 's'} affichée
        {visiblePoints.length === 1 ? '' : 's'}
      </p>
      <div className="position-relative">
        <div
          ref={containerRef}
          className="rounded border overflow-hidden"
          style={{ height: 520 }}
          data-testid="database-map-view"
        />
        {selectedPoint && (
          <div
            className="card shadow position-absolute bottom-0 start-0 m-3"
            style={{ maxWidth: 340, zIndex: 2 }}
          >
            <div className="card-body py-2 px-3 d-flex align-items-start gap-3">
              <div>
                <a
                  className="fw-bold text-decoration-none"
                  href={`/navigation/${databaseId}/record/${selectedPoint.record_id}`}
                >
                  {selectedPoint.record_title}
                </a>
                <div className="small text-muted">{selectedPoint.table_name}</div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Fermer"
                onClick={() => setSelectedPoint(null)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function pointKey(point: DatabaseMapPoint) {
  return `${point.record_id}-${point.field_name}`;
}
function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b)
  );
}
