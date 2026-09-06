'use client';

import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fmtDate, fmtHours } from '@/lib/format';
import { legHours } from '@/lib/trip';
import type { Scenario } from '@/lib/types';
import { weatherFor } from '@/lib/weather';
import type { TripState } from './useTrip';

/** Every Mapbox request goes through our own endpoint, which attaches the token (ADR-0001). */
const proxied = (url: string) => `/api/mapbox?u=${encodeURIComponent(url)}`;

const ROUTE_COLOR = '#2c5424';
const BRANCH_COLOR = '#1f5978';
const PARK_COLOR = '#a5461c';
const CHARGER_COLOR = '#c02f22';

function stopPopupHTML(scenario: Scenario, trip: TripState, id: string, label: string): string {
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
  const [failed, setFailed] = useState(false);
  const [chargersOn, setChargersOn] = useState(true);

  useEffect(() => {
    if (!container.current || map.current) return;
    if (!mapboxgl.supported?.()) {
      setFailed(true);
      return;
    }

    // GL JS requires a token to be set. The proxy replaces it on every request,
    // so this placeholder never reaches Mapbox and grants nothing.
    mapboxgl.accessToken = 'proxied';

    const instance = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
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
    const guard = setTimeout(() => setFailed(true), 9000);

    instance.on('load', () => {
      clearTimeout(guard);
      const line = (coords: [number, number][]) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: coords.map(([lat, lon]) => [lon, lat]) },
      });

      instance.addSource('dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      instance.setTerrain({ source: 'dem', exaggeration: 1.15 });

      instance.addSource('route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [line(scenario.geometry.main), line(scenario.geometry.direct)],
        },
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
      instance.addLayer({
        id: 'chargers',
        type: 'circle',
        source: 'chargers',
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
          'text-field': ['concat', ['get', 'name'], '  ', ['to-string', ['get', 'stalls']], ' stalls'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
        },
        paint: { 'text-color': CHARGER_COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
      });

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
    });

    instance.on('error', (e) => {
      const message = e.error?.message ?? '';
      if (/access token|Unauthorized|401|403|503/i.test(message)) setFailed(true);
    });

    return () => {
      clearTimeout(guard);
      instance.remove();
      map.current = null;
    };
    // Built once. Popups read the trip at build time; a settings change does not
    // need the map torn down and rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  function toggleChargers() {
    const instance = map.current;
    if (!instance) return;
    const next = !chargersOn;
    setChargersOn(next);
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
        <button type="button" className="mapbtn" onClick={toggleChargers} aria-pressed={chargersOn}>
          {chargersOn ? 'Hide chargers' : 'Show chargers'}
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
