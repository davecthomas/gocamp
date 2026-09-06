'use client';

import { fmtDate, fmtHours } from '@/lib/format';
import { legEnergy, legHours, roadStatus } from '@/lib/trip';
import type { Leg, Scenario } from '@/lib/types';
import { weatherFor } from '@/lib/weather';
import type { TripState } from './useTrip';

function markerFor(leg: Leg): string {
  if (leg.badge.kind === 'np') return '▲';
  if (leg.badge.kind === 'nf') return '🌲';
  if (leg.badge.kind === 'sp') return '■';
  return '●';
}

function WeatherRow({ scenario, leg, trip }: { scenario: Scenario; leg: Leg; trip: TripState }) {
  const date = trip.schedule.dates[leg.id];
  const weather = weatherFor(leg, date);
  if (!weather && !date) return null;

  const season = scenario.roadSeasons.find((s) => s.legId === leg.id);
  const road = season ? roadStatus(season, date) : null;

  return (
    <div className="wxrow">
      {date && <span className="wxdate">{fmtDate(date)}</span>}
      {weather && (
        <>
          <span className="wxtemp">
            {weather.highF}° / {weather.lowF}°F
          </span>
          <span className="wxnote">
            {weather.month} normals, {weather.precipIn.toFixed(1)} in, {weather.note} · {weather.station} station
            {weather.liftFt > 0 &&
              `, adjusted ${weather.liftF}° colder for the ${weather.liftFt.toLocaleString()} ft it sits above that station`}
          </span>
          {weather.freezes && <span className="wxfreeze">nights at or below freezing</span>}
        </>
      )}
      {road && !road.open && (
        <span className="wxclosed">
          {road.season.name} is normally closed on this date. Its usual season is {road.window}.
        </span>
      )}
    </div>
  );
}

export function StopList({ scenario, trip }: { scenario: Scenario; trip: TripState }) {
  const { settings, legs } = trip;

  return (
    <div className="spine">
      {legs.map((leg) => {
        const energy = legEnergy(leg, scenario.vehicle, scenario.defaults.payloadLb, settings);
        const isBranch = scenario.branchLegs.some((b) => b.id === leg.id);
        const delta = leg.elevation.endFt - leg.elevation.startFt;

        return (
          <div className={`stop${isBranch ? ' branch' : ''}`} key={leg.id}>
            <div className="marker" aria-hidden="true">
              {markerFor(leg)}
            </div>
            <div className="card" data-leg={leg.id}>
              <div className="card-top">
                <div>
                  <h3>{leg.title}</h3>
                  <div className="badges">
                    <span className={`badge ${leg.badge.kind}`}>{leg.badge.text}</span>
                  </div>
                </div>
                <div className="mile">
                  {leg.miles} mi · {fmtHours(legHours(leg, settings.avgSpeedMph))}
                </div>
              </div>

              <div className="legrow">
                <span className="elev">
                  {leg.elevation.startFt.toLocaleString()} ft → {leg.elevation.endFt.toLocaleString()} ft{' '}
                  <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
                    {delta >= 0 ? '+' : ''}
                    {delta.toLocaleString()} ft
                  </span>
                </span>
                {leg.camp && <span>⛺ {leg.camp}</span>}
              </div>

              <WeatherRow scenario={scenario} leg={leg} trip={trip} />
              <p className="note">{leg.note}</p>

              <div className={`dogpill ${leg.dog.level}`}>
                🐾 {leg.dog.level === 'good' ? 'Trail-friendly — ' : 'Restricted — '}
                {leg.dog.note}
              </div>

              <div className="rangebit">
                {energy.climbCostMi > 0.5 ? (
                  <>
                    ⛰ climb tax: <b className="tax">+{Math.round(energy.climbCostMi)} mi</b> of effective range
                  </>
                ) : energy.regenMi > 0.5 ? (
                  <>
                    ↓ regen bonus: <b>−{Math.round(energy.regenMi)} mi</b> of effective range
                  </>
                ) : (
                  'negligible altitude effect'
                )}
              </div>

              {leg.links && (
                <div className="linkrow">
                  {leg.links.map((link) => (
                    <a
                      key={link.url}
                      className={`linkbtn${link.reserve ? ' reserve' : ''}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener"
                    >
                      {link.reserve ? '⛺ ' : ''}
                      {link.label}
                      {link.reserve ? '' : ' ↗'}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
