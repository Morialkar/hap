import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Coordinates {
  lat: number;
  lng: number;
}

interface GpsMapPickerProps {
  coordinates: Coordinates | null;
  onChange: (coordinates: Coordinates) => void;
}

const DEFAULT_CENTER: Coordinates = {
  lat: 45.5017,
  lng: -73.5673,
};

const LOCAL_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#d9e2e7',
      },
    },
  ],
};

export function GpsMapPicker({ coordinates, onChange }: GpsMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const markerRef = useRef<import('maplibre-gl').Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const latestCoordinatesRef = useRef(coordinates);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const coordinateLat = coordinates?.lat;
  const coordinateLng = coordinates?.lng;

  onChangeRef.current = onChange;
  latestCoordinatesRef.current = coordinates;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let isMounted = true;

    void import('maplibre-gl')
      .then((maplibregl) => {
        if (!isMounted || !containerRef.current) {
          return;
        }

        const center = latestCoordinatesRef.current ?? DEFAULT_CENTER;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: LOCAL_STYLE as maplibregl.StyleSpecification,
          center: [center.lng, center.lat],
          zoom: latestCoordinatesRef.current ? 8 : 4,
          attributionControl: false,
        });

        const marker = new maplibregl.Marker({
          color: '#2f6f4e',
          draggable: true,
        })
          .setLngLat([center.lng, center.lat])
          .addTo(map);

        marker.on('dragend', () => {
          const next = marker.getLngLat();
          onChangeRef.current({
            lat: roundCoordinate(next.lat),
            lng: roundCoordinate(next.lng),
          });
        });

        map.on('click', (event) => {
          const next = {
            lat: roundCoordinate(event.lngLat.lat),
            lng: roundCoordinate(event.lngLat.lng),
          };
          marker.setLngLat([next.lng, next.lat]);
          onChangeRef.current(next);
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        mapRef.current = map;
        markerRef.current = marker;

        if (latestCoordinatesRef.current) {
          syncMarkerToCoordinates(map, marker, latestCoordinatesRef.current, 0);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsUnavailable(true);
        }
      });

    return () => {
      isMounted = false;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      coordinateLat === undefined ||
      coordinateLng === undefined ||
      !markerRef.current ||
      !mapRef.current
    ) {
      return;
    }

    syncMarkerToCoordinates(
      mapRef.current,
      markerRef.current,
      {
        lat: coordinateLat,
        lng: coordinateLng,
      },
      250
    );
  }, [coordinateLat, coordinateLng]);

  if (isUnavailable) {
    return (
      <div className="alert alert-warning mb-0" role="status">
        Map picker unavailable. Latitude and longitude can still be entered manually.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded border overflow-hidden"
      style={{ height: 220 }}
      data-testid="gps-map-picker"
    />
  );
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function syncMarkerToCoordinates(
  map: import('maplibre-gl').Map,
  marker: import('maplibre-gl').Marker,
  coordinates: Coordinates,
  duration: number
) {
  marker.setLngLat([coordinates.lng, coordinates.lat]);
  map.easeTo({
    center: [coordinates.lng, coordinates.lat],
    zoom: Math.max(map.getZoom(), 8),
    duration,
  });
}
