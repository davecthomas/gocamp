'use client';

import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fmtDate, fmtHours } from '@/lib/format';
import { legHours } from '@/lib/trip';
import type { Scenario } from '@/lib/types';
import { weatherFor } from '@/lib/weather';
import type { TripState } from './useTrip';

/**
 * Every Mapbox request goes through our own endpoint, which attaches the token (ADR-0001).
 *
 * Absolute, not root-relative. GL JS fetches tiles from a worker it creates out of a
 * blob URL, and a blob URL has an opaque path, so resolving `/api/mapbox` against it
 * throws inside the worker and the tile request never leaves the browser.
 */
const proxied = (url: string) => `${window.location.origin}/api/mapbox?u=${encodeURIComponent(url)}`;

const ROUTE_COLOR = '#2c5424';
const BRANCH_COLOR = '#1f5978';
const PARK_COLOR = '#a5461c';
const CHARGER_COLOR = '#c02f22';

/**
 * Mapbox's own styles. Outdoors reads as a near-blank pale wash at the zoom this
 * route sits at (mostly light terrain fill, thin lines, little built-up area to
 * give it contrast), so Streets is the default: it carries real color at any
 * zoom. Outdoors stays in the list for anyone who wants the contour detail once
 * they're zoomed into a single pass.
 */
const MAP_STYLES = [
  { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'light', label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
  { id: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'satellite', label: 'Satellite streets', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'navday', label: 'Navigation day', url: 'mapbox://styles/mapbox/navigation-day-v1' },
] as const;

type MapStyleId = (typeof MAP_STYLES)[number]['id'];
const DEFAULT_STYLE: MapStyleId = 'streets';

function stopPopupHTML(scenario: Scenario, trip: TripState, id: string, label: string): string {
  // The branch stop stays on the map even when the branch toggle is off, so its
  // leg may not be in trip.legs; fall back to the scenario's branch leg for it.
  const leg = trip.legs.find((l) => l.id === id) ?? scenario.branchLegs.find((l) => l.id === id);
  if (!leg) return `<h5>${label}</h5>`;

  const date = trip.schedule.dates[leg.id];
  const weather = weatherFor(leg, date);
  const rows: string[] = [
    `<h5>${leg.title}</h5>`,
    `<div style="font-size:.7rem;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em">${leg.badge.text}</div>`,
    `<div style="font-size:.75rem;margin-top:.3rem">Elevation ${leg.elevation.endFt.toLocaleString()} ft${
      leg.miles > 0 ? ` · leg ${leg.miles} mi, ${fmtHours(legHours(leg, trip.settings.avgSpeedMph))}` : ''
    }</div>`,
  ];
  if (weather) {
    rows.push(
      `<div style="font-size:.75rem;margin-top:.3rem">${date ? `<b>${fmtDate(date)}</b> · ` : ''}${weather.highF}° / ${
        weather.lowF
      }°F, ${weather.month} normals${weather.freezes ? ' · freezing nights' : ''}</div>`,
    );
  }
  if (leg.camp) rows.push(`<div style="font-size:.75rem;margin-top:.3rem">⛺ ${leg.camp}</div>`);
  rows.push(
    `<div style="font-size:.73rem;margin-top:.3rem;color:${
      leg.dog.level === 'good' ? 'var(--good)' : 'var(--clay)'
    }">🐾 ${leg.dog.note}</div>`,
  );
  if (leg.links) {
    rows.push(
      `<div class="pop-links" style="margin-top:.45rem">${leg.links
        .map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${l.label} ↗</a>`)
        .join('')}</div>`,
    );
  }
  return rows.join('');
}

export function MapView({ scenario, trip }: { scenario: Scenario; trip: TripState }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const chargersOn = useRef(true);
  const isFirstStyleChange = useRef(true);
  const [failed, setFailed] = useState(false);
  const [chargersVisible, setChargersVisible] = useState(true);
  const [styleId, setStyleId] = useState<MapStyleId>(DEFAULT_STYLE);

  // Build the map once. Sources and layers are (re)built by addLayers, which runs
  // on every 'style.load' — including the ones setStyle triggers later — since
  // swapping styles discards everything the previous style owned.
  useEffect(() => {
    if (!container.current || map.current) return;
    if (!mapboxgl.supported?.()) {
      setFailed(true);
      return;
    }

    // GL JS requires a token to be set. The proxy replaces it on every request,
    // so this placeholder never reaches Mapbox and grants nothing.
    mapboxgl.accessToken = 'proxied';

    const startStyle = MAP_STYLES.find((s) => s.id === DEFAULT_STYLE)!.url;
    const instance = new mapboxgl.Map({
      container: container.current,
      style: startStyle,
      center: [-110.5, 42.5],
      zoom: 4.2,
      cooperativeGestures: true,
      transformRequest: (url) =>
        url.startsWith('https://api.mapbox.com/') || url.startsWith('https://events.mapbox.com/')
          ? { url: proxied(url) }
          : { url },
    });
    map.current = instance;
    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-left');
    instance.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left');

    const bounds = new mapboxgl.LngLatBounds();
    for (const [lat, lon] of [...scenario.geometry.main, ...scenario.geometry.direct, ...scenario.geometry.branch]) {
      bounds.extend([lon, lat]);
    }

    // If the map never finishes — no WebGL, a blocked host, a tab that never
    // paints — fall back rather than leaving an empty frame (ADR-0006).
    let guard: ReturnType<typeof setTimeout> | null = setTimeout(() => setFailed(true), 9000);
    let firstLoad = true;

    function addLayers() {
      if (guard) {
        clearTimeout(guard);
        guard = null;
      }
      const line = (coords: [number, number][]) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: coords.map(([lat, lon]) => [lon, lat]) },
      });

      if (!instance.getSource('dem')) {
        instance.addSource('dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      instance.setTerrain({ source: 'dem', exaggeration: 1.15 });

      instance.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [line(scenario.geometry.main), line(scenario.geometry.direct)] },
      });
      instance.addSource('branch', { type: 'geojson', data: line(scenario.geometry.branch) });
      instance.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7.5, 'line-opacity': 0.85 },
      });
      instance.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ROUTE_COLOR, 'line-width': 4 },
      });
      instance.addLayer({
        id: 'branch',
        type: 'line',
        source: 'branch',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': BRANCH_COLOR, 'line-width': 3.5, 'line-dasharray': [2, 1.6] },
      });

      instance.addSource('chargers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: scenario.chargers.map((c) => ({
            type: 'Feature' as const,
            properties: { name: c.name, stalls: c.stalls, kw: c.kw },
            geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
          })),
        },
      });
      const visibility = chargersOn.current ? 'visible' : 'none';
      instance.addLayer({
        id: 'chargers',
        type: 'circle',
        source: 'chargers',
        layout: { visibility },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 8, 5, 12, 8],
          'circle-color': CHARGER_COLOR,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.95,
        },
      });
      instance.addLayer({
        id: 'charger-labels',
        type: 'symbol',
        source: 'chargers',
        minzoom: 8,
        layout: {
          visibility,
          'text-field': ['concat', ['get', 'name'], '  ', ['to-string', ['get', 'stalls']], ' stalls'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: { 'text-color': CHARGER_COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
      });

      if (firstLoad) {
        firstLoad = false;

        const hover = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
        instance.on('mouseenter', 'chargers', (e) => {
          instance.getCanvas().style.cursor = 'pointer';
          const f = e.features?.[0];
          if (!f || f.geometry.type !== 'Point') return;
          const p = f.properties as { name: string; stalls: number; kw: number };
          hover
            .setLngLat(f.geometry.coordinates as [number, number])
            .setHTML(`<b>${p.name}</b><br>${p.stalls} stalls · ${p.kw} kW`)
            .addTo(instance);
        });
        instance.on('mouseleave', 'chargers', () => {
          instance.getCanvas().style.cursor = '';
          hover.remove();
        });

        for (const stop of scenario.mapStops) {
          const isPark = stop.kind === 'np' || stop.kind === 'sp' || stop.kind === 'nf';
          const el = document.createElement('div');
          const size = isPark ? 16 : 13;
          el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;cursor:pointer;background:${
            isPark ? PARK_COLOR : ROUTE_COLOR
          };border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)`;
          el.title = stop.label;
          new mapboxgl.Marker({ element: el })
            .setLngLat([stop.lon, stop.lat])
            .setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(stopPopupHTML(scenario, trip, stop.id, stop.label)))
            .addTo(instance);
        }

        instance.fitBounds(bounds, { padding: 26, duration: 0 });
      }
    }

    // Fires on the initial style and again on every setStyle, which is what lets
    // the style picker swap basemaps without losing the route, stops or chargers.
    instance.on('style.load', addLayers);

    instance.on('error', (e) => {
      const message = e.error?.message ?? '';
      if (/access token|Unauthorized|401|403|503/i.test(message)) setFailed(true);
    });

    return () => {
      if (guard) clearTimeout(guard);
      instance.remove();
      map.current = null;
    };
    // Built once. Popups read the trip at build time; a settings change does not
    // need the map torn down and rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  // Swapping styles is cheap: setStyle, and 'style.load' rebuilds the overlay.
  useEffect(() => {
    if (isFirstStyleChange.current) {
      isFirstStyleChange.current = false;
      return;
    }
    const style = MAP_STYLES.find((s) => s.id === styleId);
    if (style && map.current) map.current.setStyle(style.url);
  }, [styleId]);

  function toggleChargers() {
    const instance = map.current;
    const next = !chargersOn.current;
    chargersOn.current = next;
    setChargersVisible(next);
    if (!instance) return;
    for (const id of ['chargers', 'charger-labels']) {
      if (instance.getLayer(id)) instance.setLayoutProperty(id, 'visibility', next ? 'visible' : 'none');
    }
  }

  if (failed) {
    return (
      <div className="mapcard">
        <p className="maphint">
          The map could not load, so it is not shown. Every stop below carries the same elevation, camp, weather and
          booking detail.
        </p>
      </div>
    );
  }

  return (
    <div className="mapcard">
      <div className="mapctl" role="group" aria-label="Map view controls">
        <label className="mapselect-wrap">
          <span className="sr-only">Map style</span>
          <select
            className="mapselect"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value as MapStyleId)}
          >
            {MAP_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mapbtn" onClick={toggleChargers} aria-pressed={chargersVisible}>
          {chargersVisible ? 'Hide chargers' : 'Show chargers'}
        </button>
      </div>
      <div ref={container} className="realmap on" />
      <p className="maphint">
        Click any pin for elevation, camp, dog rules, dates, weather and booking links. Drag to pan, and zoom in for
        streets, terrain and charger names.
      </p>
    </div>
  );
}
