'use client';

import { fmtDate, fmtHours, mi, toDateInput } from '@/lib/format';
import { failingGap, longestGap, roadStatus } from '@/lib/trip';
import type { Scenario } from '@/lib/types';
import { Collapsible } from './Collapsible';
import type { TripState } from './useTrip';

function Slider({
  label,
  value,
  sub,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: string;
  sub?: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="field">
      <label>
        {label} <span className="val">{value}</span>
        {sub && <span className="sublabel"> {sub}</span>}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(String(value).replace(/[^\d.]/g, ''))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function TripSettingsPanel({ scenario, trip }: { scenario: Scenario; trip: TripState }) {
  const { settings, update, setArrival, totals, schedule, startDate, arrival } = trip;
  const { vehicle, payloadBreakdown } = scenario;

  const worst = longestGap(scenario.chargerGaps);
  const failing = failingGap(scenario.chargerGaps, totals.usableMi);

  const roadNotes = scenario.roadSeasons
    .filter((season) => season.legId !== 'b1' || settings.includeBranch)
    .map((season) => roadStatus(season, schedule.dates[season.legId]))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <>
      <div className="vehicle">
        <div>
          <div className="vname">{vehicle.name}</div>
          <div className="vspecs">
            <span>
              Usable battery <b>{vehicle.batteryKwh} kWh</b>
            </span>
            <span>
              EPA range <b>{vehicle.epaRangeMi} mi</b>
            </span>
            <span>
              Curb weight <b>{vehicle.curbLb.toLocaleString()} lb</b>
            </span>
            <span>
              Loaded <b>{(vehicle.curbLb + settings.payloadLb).toLocaleString()} lb</b>
            </span>
            <span>
              DC fast charge <b>{vehicle.fastChargeNote}</b>
            </span>
            <span>
              Port <b>{vehicle.port}</b>
            </span>
          </div>
          <Collapsible title="Where these specs come from">
            <p>{vehicle.sourceNote}</p>
            <p>
              Load on board defaults to {payloadBreakdown.adults} lb of adults, a {payloadBreakdown.dog} lb dog and{' '}
              {payloadBreakdown.gear} lb of camping gear and luggage. Weight moves only the climbing maths. Every extra
              pound costs energy to lift over a pass, and gives some of it back on the descent.
            </p>
          </Collapsible>
        </div>
      </div>

      <div className="calc">
        <div className="calc-row">
          <Slider
            label="Miles between charging stops:"
            value={`${settings.cadenceMi} mi`}
            sub={`· ${fmtHours(settings.cadenceMi / settings.avgSpeedMph)} at ${settings.avgSpeedMph} mph`}
            min={120}
            max={400}
            step={10}
            onChange={(n) => update('cadenceMi', n)}
          />
          <Slider
            label="Nights spent at each park/camp stop:"
            value={`${settings.nights} ${settings.nights === 1 ? 'night' : 'nights'}`}
            min={1}
            max={3}
            step={1}
            onChange={(n) => update('nights', n)}
          />
          <Slider
            label="Average driving speed:"
            value={`${settings.avgSpeedMph} mph`}
            min={45}
            max={80}
            step={1}
            onChange={(n) => update('avgSpeedMph', n)}
          />
          <Slider
            label="Load on board:"
            value={`${settings.payloadLb.toLocaleString()} lb`}
            sub={`· adults ${payloadBreakdown.adults} · dog ${payloadBreakdown.dog} · gear ${payloadBreakdown.gear}`}
            min={200}
            max={1400}
            step={10}
            onChange={(n) => update('payloadLb', n)}
          />
          <Slider
            label="Never drop below:"
            value={`${settings.reservePct}%`}
            sub={`· ${Math.round(totals.usableMi)} mi usable of ${Math.round(totals.rangeMi)} mi`}
            min={5}
            max={50}
            step={1}
            onChange={(n) => update('reservePct', n)}
          />

          {scenario.branch && (
            <div className="toggle-row">
              <button
                type="button"
                className={`switch${settings.includeBranch ? ' on' : ''}`}
                role="switch"
                aria-checked={settings.includeBranch}
                aria-label={scenario.branch.label}
                onClick={() => update('includeBranch', !settings.includeBranch)}
              >
                <span className="knob" />
              </button>
              <div>
                <div className="tlabel">{scenario.branch.label}</div>
                <div className="tsub">{scenario.branch.sublabel}</div>
              </div>
            </div>
          )}
        </div>

        <div className="calc-row datepick">
          <div className="field">
            <label htmlFor="startDate">Leave {scenario.legs[0]?.from ?? 'the start'}</label>
            <input
              id="startDate"
              type="date"
              value={settings.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="endDate">Reach {scenario.finalLegs.at(-1)?.title ?? 'the end'}</label>
            <input
              id="endDate"
              type="date"
              value={arrival ? toDateInput(arrival) : ''}
              onChange={(e) => setArrival(e.target.value)}
            />
          </div>
          <div className="field datesum">
            {startDate && arrival ? (
              <>
                <b>
                  {fmtDate(startDate)} → {fmtDate(arrival)}, {arrival.getFullYear()}
                </b>{' '}
                · {schedule.totalDays} days on the road.{' '}
                {roadNotes.map((note) => (
                  <span key={note.season.name} className={note.open ? 'okline' : 'warn'}>
                    {note.season.name} {note.open ? 'open' : `normally closed (${note.window})`}.{' '}
                  </span>
                ))}
              </>
            ) : (
              'Pick a departure date to schedule the stops and their typical weather.'
            )}
          </div>
        </div>

        <div className="calc-out">
          <div className="cell">
            <div className="n pine">{mi(totals.flatMi)}</div>
            <div className="l">Flat-road miles</div>
          </div>
          <div className="cell">
            <div className="n clay">{mi(totals.effectiveMi)}</div>
            <div className="l">Altitude-effective miles</div>
          </div>
          <div className="cell">
            <div className="n clay">
              {totals.climbTaxMi >= 0 ? '+' : ''}
              {Math.round(totals.climbTaxMi)} mi
            </div>
            <div className="l">Net climbing tax</div>
          </div>
          <div className="cell">
            <div className="n pine">{mi(totals.rangeMi)}</div>
            <div className="l">Range at this load &amp; speed</div>
          </div>
          <div className="cell">
            <div className="n pine">{mi(totals.usableMi)}</div>
            <div className="l">Usable above reserve</div>
          </div>
          <div className="cell">
            <div className="n pine">{totals.chargingStops}</div>
            <div className="l">Charging stops</div>
          </div>
          <div className="cell">
            <div className="n pine">{schedule.totalDays}</div>
            <div className="l">Total trip days</div>
          </div>
        </div>

        <p className="rangewarn">
          {totals.intervalClamped ? (
            <span className="warn">
              Your {settings.cadenceMi} mi interval exceeds the {Math.round(totals.usableMi)} mi you can use above a{' '}
              {settings.reservePct}% reserve, so the plan stops every {Math.round(totals.planIntervalMi)} mi instead.
            </span>
          ) : (
            <span className="ok">
              {settings.cadenceMi} mi between stops uses {Math.round((settings.cadenceMi / totals.usableMi) * 100)}% of
              the {Math.round(totals.usableMi)} mi you can use above a {settings.reservePct}% reserve.
            </span>
          )}{' '}
          {failing ? (
            <span className="warn">
              The {failing.miles} mi run from {failing.from} to {failing.to} has no Supercharger on it and exceeds that.
              Slow down, lighten the load, or cut the reserve.
            </span>
          ) : (
            worst && (
              <>
                Longest Supercharger gap on the route is {worst.miles} mi, {worst.from} to {worst.to}, which fits with{' '}
                {Math.round(totals.usableMi - worst.miles)} mi to spare.
              </>
            )
          )}{' '}
          Drawn at {Math.round(totals.whPerMile)} Wh/mi.
        </p>

        <Collapsible title="How the numbers are computed">
          {scenario.content.howComputed.map((paragraph, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: paragraph }} />
          ))}
        </Collapsible>
      </div>
    </>
  );
}
