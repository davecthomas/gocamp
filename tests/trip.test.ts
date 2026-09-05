import { describe, expect, it } from 'vitest';
import { getScenario } from '../lib/scenarios';
import {
  BASELINE_MPH,
  buildSchedule,
  computeTotals,
  failingGap,
  legEnergy,
  legHours,
  legsFor,
  longestGap,
  rangeMi,
  roadStatus,
  usableRangeMi,
  whPerMile,
} from '../lib/trip';
import { weatherFor } from '../lib/weather';
import type { Scenario, TripSettings } from '../lib/types';

const scenario = getScenario('rockies-line') as Scenario;
const base: TripSettings = { ...scenario.defaults };

describe('scenario loading', () => {
  it('loads the YAML and validates it', () => {
    expect(scenario).not.toBeNull();
    expect(scenario.slug).toBe('rockies-line');
  });

  it('has every leg carrying the fields the UI reads', () => {
    for (const leg of legsFor(scenario, true)) {
      expect(leg.id).toBeTruthy();
      expect(leg.title).toBeTruthy();
      expect(leg.badge.text).toBeTruthy();
      expect(leg.dog.note).toBeTruthy();
      expect(Number.isFinite(leg.elevation.startFt)).toBe(true);
    }
  });
});

describe('road-load model', () => {
  it('reproduces the published EPA range at the default load and baseline speed', () => {
    const wh = whPerMile(scenario.vehicle, scenario.defaults.payloadLb, scenario.defaults.payloadLb, BASELINE_MPH);
    expect(wh).toBeCloseTo((scenario.vehicle.batteryKwh * 1000) / scenario.vehicle.epaRangeMi, 6);
    const range = rangeMi(scenario.vehicle, scenario.defaults.payloadLb, scenario.defaults.payloadLb, BASELINE_MPH);
    expect(range).toBeCloseTo(scenario.vehicle.epaRangeMi, 6);
  });

  it('loses range as the load grows', () => {
    const light = rangeMi(scenario.vehicle, scenario.defaults.payloadLb, 200, BASELINE_MPH);
    const heavy = rangeMi(scenario.vehicle, scenario.defaults.payloadLb, 1400, BASELINE_MPH);
    expect(heavy).toBeLessThan(light);
  });

  it('loses range as speed rises, faster than linearly', () => {
    const p = scenario.defaults.payloadLb;
    const at55 = rangeMi(scenario.vehicle, p, p, 55);
    const at65 = rangeMi(scenario.vehicle, p, p, 65);
    const at80 = rangeMi(scenario.vehicle, p, p, 80);
    expect(at55).toBeGreaterThan(at65);
    expect(at65).toBeGreaterThan(at80);
    expect(at65 - at80).toBeGreaterThan(at55 - at65);
  });
});

describe('elevation energy', () => {
  const trailRidge = scenario.legs.find((l) => l.id === 'l4')!;
  const descent = scenario.legs.find((l) => l.id === 'l5')!;

  it('charges for a climb and credits a descent', () => {
    const up = legEnergy(trailRidge, scenario.vehicle, scenario.defaults.payloadLb, base);
    const down = legEnergy(descent, scenario.vehicle, scenario.defaults.payloadLb, base);
    expect(up.climbCostMi).toBeGreaterThan(0);
    expect(up.regenMi).toBe(0);
    expect(down.regenMi).toBeGreaterThan(0);
    expect(down.climbCostMi).toBe(0);
  });

  it('never returns more on the way down than the climb cost', () => {
    const up = legEnergy(trailRidge, scenario.vehicle, scenario.defaults.payloadLb, base);
    const perFootUp = up.climbCostMi / (trailRidge.elevation.endFt - trailRidge.elevation.startFt);
    const down = legEnergy(descent, scenario.vehicle, scenario.defaults.payloadLb, base);
    const perFootDown = down.regenMi / (descent.elevation.startFt - descent.elevation.endFt);
    expect(perFootDown).toBeLessThan(perFootUp);
  });

  it('charges a heavier car more to climb', () => {
    const light = legEnergy(trailRidge, scenario.vehicle, scenario.defaults.payloadLb, { ...base, payloadLb: 200 });
    const heavy = legEnergy(trailRidge, scenario.vehicle, scenario.defaults.payloadLb, { ...base, payloadLb: 1400 });
    expect(heavy.climbCostMi).toBeGreaterThan(light.climbCostMi);
  });
});

describe('schedule', () => {
  it('gives every leg a date and runs in order', () => {
    const legs = legsFor(scenario, false);
    const s = buildSchedule(legs, base.nights, base.avgSpeedMph, new Date(2027, 5, 19));
    expect(Object.keys(s.dates)).toHaveLength(legs.length);
    let previous = -1;
    for (const leg of legs) {
      const offset = s.dayOffsets[leg.id]!;
      expect(offset).toBeGreaterThanOrEqual(previous);
      previous = offset;
    }
  });

  it('adds a day per overnight stop for each extra night', () => {
    const legs = legsFor(scenario, false);
    const one = buildSchedule(legs, 1, base.avgSpeedMph, null);
    const two = buildSchedule(legs, 2, base.avgSpeedMph, null);
    const overnights = legs.filter((l) => l.overnight).length;
    expect(two.totalDays - one.totalDays).toBe(overnights);
  });

  it('shortens the trip when you drive faster', () => {
    const legs = legsFor(scenario, false);
    const slow = buildSchedule(legs, 1, 50, null);
    const fast = buildSchedule(legs, 1, 80, null);
    expect(fast.totalDays).toBeLessThanOrEqual(slow.totalDays);
  });

  it('splits a leg that exceeds a day at the wheel', () => {
    const long = scenario.legs.find((l) => legHours(l, BASELINE_MPH) > 7.5);
    expect(long).toBeDefined();
  });
});

describe('reserve and charger gaps', () => {
  it('leaves less usable range as the reserve rises', () => {
    expect(usableRangeMi(450, 25)).toBeCloseTo(337.5);
    expect(usableRangeMi(450, 50)).toBeCloseTo(225);
  });

  it('clamps the planned interval to what the reserve allows', () => {
    const totals = computeTotals(scenario, { ...base, reservePct: 50, cadenceMi: 400 });
    expect(totals.intervalClamped).toBe(true);
    expect(totals.planIntervalMi).toBeCloseTo(totals.usableMi);
  });

  it('flags the gap that will not fit at a high reserve', () => {
    const totals = computeTotals(scenario, { ...base, reservePct: 50 });
    const bad = failingGap(scenario.chargerGaps, totals.usableMi);
    expect(bad).not.toBeNull();
    expect(bad!.miles).toBeGreaterThan(totals.usableMi);
  });

  it('clears every gap at the default reserve', () => {
    const totals = computeTotals(scenario, base);
    expect(failingGap(scenario.chargerGaps, totals.usableMi)).toBeNull();
  });

  it('knows the longest gap on the route', () => {
    const worst = longestGap(scenario.chargerGaps)!;
    for (const gap of scenario.chargerGaps) expect(gap.miles).toBeLessThanOrEqual(worst.miles);
  });
});

describe('totals', () => {
  it('counts distinct parks rather than legs', () => {
    const withBranch = computeTotals(scenario, { ...base, includeBranch: true });
    const without = computeTotals(scenario, { ...base, includeBranch: false });
    expect(withBranch.parkCount).toBe(without.parkCount + 1);
  });

  it('makes the branch longer than the direct route', () => {
    const withBranch = computeTotals(scenario, { ...base, includeBranch: true });
    const without = computeTotals(scenario, { ...base, includeBranch: false });
    expect(withBranch.flatMi).toBeGreaterThan(without.flatMi);
  });

  it('charges a climbing tax overall', () => {
    expect(computeTotals(scenario, base).climbTaxMi).toBeGreaterThan(0);
  });
});

describe('road seasons', () => {
  it('opens Trail Ridge in summer and closes it in winter', () => {
    const season = scenario.roadSeasons.find((r) => r.legId === 'l4')!;
    expect(roadStatus(season, new Date(2027, 6, 1))!.open).toBe(true);
    expect(roadStatus(season, new Date(2027, 10, 1))!.open).toBe(false);
  });
});

describe('weather', () => {
  it('corrects a high stop for its lift above the station', () => {
    const summit = scenario.legs.find((l) => l.id === 'l4')!;
    const june = weatherFor(summit, new Date(2027, 5, 21))!;
    expect(summit.stationLiftFt).toBeGreaterThan(0);
    expect(june.liftF).toBeGreaterThan(0);
    expect(june.freezes).toBe(true);
    expect(june.highF).toBeLessThan(70);
  });

  it('leaves a stop at its station uncorrected', () => {
    const amarillo = scenario.legs.find((l) => l.id === 'l1')!;
    const june = weatherFor(amarillo, new Date(2027, 5, 19))!;
    expect(june.liftFt).toBe(0);
    expect(june.highF).toBeGreaterThan(80);
  });
});
