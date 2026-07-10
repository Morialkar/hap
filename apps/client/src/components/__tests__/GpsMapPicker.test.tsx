import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GpsMapPicker } from '../GpsMapPicker';

const maplibreMock = vi.hoisted(() => {
  const mapInstances: FakeMap[] = [];
  const markerInstances: FakeMarker[] = [];

  class FakeMap {
    handlers: Record<string, (event: { lngLat: { lat: number; lng: number } }) => void> = {};
    zoom = 4;

    constructor() {
      mapInstances.push(this);
    }

    on(event: string, handler: (event: { lngLat: { lat: number; lng: number } }) => void) {
      this.handlers[event] = handler;
    }

    addControl = vi.fn();
    easeTo = vi.fn();
    getZoom = vi.fn(() => this.zoom);
    remove = vi.fn();
  }

  class FakeMarker {
    handlers: Record<string, () => void> = {};
    lngLat = { lat: 0, lng: 0 };

    constructor() {
      markerInstances.push(this);
    }

    setLngLat(nextLngLat: [number, number]) {
      this.lngLat = {
        lng: nextLngLat[0],
        lat: nextLngLat[1],
      };
      return this;
    }

    getLngLat() {
      return this.lngLat;
    }

    addTo() {
      return this;
    }

    on(event: string, handler: () => void) {
      this.handlers[event] = handler;
      return this;
    }

    remove = vi.fn();
  }

  class FakeNavigationControl {}

  return {
    mapInstances,
    markerInstances,
    FakeMap,
    FakeMarker,
    FakeNavigationControl,
  };
});

vi.mock('maplibre-gl', () => ({
  Map: maplibreMock.FakeMap,
  Marker: maplibreMock.FakeMarker,
  NavigationControl: maplibreMock.FakeNavigationControl,
}));

describe('GpsMapPicker', () => {
  beforeEach(() => {
    maplibreMock.mapInstances.length = 0;
    maplibreMock.markerInstances.length = 0;
  });

  it('updates coordinates when the map is clicked', async () => {
    const onChange = vi.fn();

    render(<GpsMapPicker coordinates={null} onChange={onChange} />);

    await waitFor(() => expect(maplibreMock.mapInstances).toHaveLength(1));

    maplibreMock.mapInstances[0].handlers.click({
      lngLat: {
        lat: 46.81234567,
        lng: -71.20123456,
      },
    });

    expect(onChange).toHaveBeenCalledWith({
      lat: 46.812346,
      lng: -71.201235,
    });
    expect(maplibreMock.markerInstances[0].lngLat).toEqual({
      lat: 46.812346,
      lng: -71.201235,
    });
  });

  it('updates coordinates when the marker drag ends', async () => {
    const onChange = vi.fn();

    render(<GpsMapPicker coordinates={{ lat: 45.5017, lng: -73.5673 }} onChange={onChange} />);

    await waitFor(() => expect(maplibreMock.markerInstances).toHaveLength(1));

    const marker = maplibreMock.markerInstances[0];
    marker.lngLat = {
      lat: 47.1234567,
      lng: -70.7654321,
    };
    marker.handlers.dragend();

    expect(onChange).toHaveBeenCalledWith({
      lat: 47.123457,
      lng: -70.765432,
    });
  });

  it('moves the marker when coordinates change from manual entry', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <GpsMapPicker coordinates={{ lat: 45.5017, lng: -73.5673 }} onChange={onChange} />
    );

    await waitFor(() => expect(maplibreMock.markerInstances).toHaveLength(1));

    rerender(<GpsMapPicker coordinates={{ lat: 46.8139, lng: -71.208 }} onChange={onChange} />);

    expect(maplibreMock.markerInstances[0].lngLat).toEqual({
      lat: 46.8139,
      lng: -71.208,
    });
    expect(maplibreMock.mapInstances[0].easeTo).toHaveBeenCalledWith({
      center: [-71.208, 46.8139],
      zoom: 8,
      duration: 250,
    });
  });
});
