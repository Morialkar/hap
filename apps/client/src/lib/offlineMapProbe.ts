import type { OfflineMapProbeResult } from '@hap/core';

/**
 * R3-A offline map proof.
 *
 * Renders MapLibre from a PMTiles archive bundled with the app and records every
 * resource the map asks for, so the run shows that nothing but the local archive is
 * needed. The production map still uses OSM raster tiles over the network; this probe
 * deliberately does not, because the spike has to show the map standing up with no
 * connectivity at all.
 */

const FIXTURE_URL = '/fixtures/r3a-countries.pmtiles';

function isLocalFixture(url: string): boolean {
  // `pmtiles://…` is resolved by the registered protocol against the local archive
  // and never reaches the network, so it is always allowed. Everything else must be
  // the bundled fixture served by the app itself.
  if (url.startsWith('pmtiles://')) return true;

  try {
    const resolved = new URL(url, window.location.href);
    return resolved.origin === window.location.origin && resolved.pathname === FIXTURE_URL;
  } catch {
    return false;
  }
}

/**
 * Under Tauri the archive is read from the bundled resource; in a browser it is
 * fetched from the public directory. Returns the identifier the style must use.
 */
async function registerArchive(protocol: {
  add: (archive: unknown) => void;
}): Promise<{ sourceUrl: string; transport: 'tauri-fs' | 'http' }> {
  const { isTauri } = await import('@tauri-apps/api/core');

  if (!isTauri()) {
    return {
      sourceUrl: `pmtiles://${new URL(FIXTURE_URL, window.location.href).href}`,
      transport: 'http',
    };
  }

  const [{ resolveResource }, { PMTiles }, { TauriFileSource }] = await Promise.all([
    import('@tauri-apps/api/path'),
    import('pmtiles'),
    import('./tauriPmtilesSource'),
  ]);

  const path = await resolveResource('fixtures/r3a-countries.pmtiles');
  const archive = new PMTiles(new TauriFileSource(path));
  protocol.add(archive);

  return { sourceUrl: `pmtiles://${path}`, transport: 'tauri-fs' };
}

/**
 * The map from the previous run, kept so a human can still see the proof after the
 * numbers are in. Torn down when the probe runs again.
 */
let liveMap: { remove: () => void } | null = null;

export async function runOfflineMapProbe(container: HTMLElement): Promise<OfflineMapProbeResult> {
  liveMap?.remove();
  liveMap = null;

  const [{ default: maplibregl }, { Protocol }] = await Promise.all([
    import('maplibre-gl'),
    import('pmtiles'),
  ]);

  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const { sourceUrl, transport } = await registerArchive(
    protocol as unknown as { add: (archive: unknown) => void }
  );

  // Every resource MapLibre resolves passes through here. Patching window.fetch
  // instead would also intercept the framework's own module and worker loading and
  // break the map before it starts.
  const blockedRequests: string[] = [];

  try {
    const map = new maplibregl.Map({
      container,
      // No glyphs and no sprite: text or icon layers would need assets the archive
      // does not carry, which is the sort of hidden network dependency this proves out.
      style: {
        version: 8,
        sources: {
          countries: { type: 'vector', url: sourceUrl },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#dbeafe' } },
          {
            id: 'countries-fill',
            type: 'fill',
            source: 'countries',
            'source-layer': 'countries',
            paint: { 'fill-color': '#bbf7d0', 'fill-outline-color': '#15803d' },
          },
        ],
      },
      center: [-73.5673, 45.5017],
      zoom: 3,
      attributionControl: false,
      transformRequest: (url: string) => {
        if (isLocalFixture(url)) return { url };
        // Anything else would be a network dependency: record it and refuse it by
        // handing MapLibre a URL it cannot resolve.
        blockedRequests.push(url);
        return { url: 'about:blank' };
      },
    });

    // Step 1 — the archive is read and decoded. This is the part that proves the map
    // works offline, and it does not depend on the host painting anything.
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('Source did not load from the bundled archive within 20s')),
        20000
      );
      const onSourceData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
        if (event.sourceId === 'countries' && event.isSourceLoaded) {
          window.clearTimeout(timeout);
          map.off('sourcedata', onSourceData);
          resolve();
        }
      };
      map.on('sourcedata', onSourceData);
      map.once('error', (event: { error?: Error }) => {
        window.clearTimeout(timeout);
        reject(event.error ?? new Error('MapLibre reported an error'));
      });
    });

    const sourceFeatures = map.querySourceFeatures('countries', {
      sourceLayer: 'countries',
    }).length;

    // Step 2 — painting. A hidden or headless webview throttles requestAnimationFrame,
    // so treat a missing frame as "not observable here" rather than as a failure.
    const painted = await new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), 5000);
      map.once('idle', () => {
        window.clearTimeout(timeout);
        resolve(true);
      });
    });

    const renderedFeatures = painted
      ? map.queryRenderedFeatures(undefined, { layers: ['countries-fill'] }).length
      : null;

    // Left on screen on purpose: destroying it here is what made the map flash and
    // vanish the moment the probe succeeded.
    liveMap = map;

    return {
      sourceFeatures,
      renderedFeatures,
      blockedRequests: [...blockedRequests],
      fixtureUrl: sourceUrl,
      transport,
    };
  } catch (error) {
    // Only tear down when the run failed; a successful map stays visible.
    maplibregl.removeProtocol('pmtiles');
    throw error;
  }
}
