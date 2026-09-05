import type { ChargerGap, Leg, RoadSeason, Scenario, TripSettings, Vehicle } from './types';

/** Pure trip maths. No DOM, no React, so it can be tested directly. */

const G = 9.80665;
const LB_PER_KG = 0.45359237;
const MPS_PER_MPH = 0.44704;
const METRES_PER_MILE = 1609.344;
const AIR_DENSITY = 1.225;
const FEET_PER_METRE = 3.280839895;
const LAPSE_F_PER_1000FT = 3.5;

/** Most hours behind the wheel the schedule will put in one day. */
export const MAX_DRIVE_HOURS = 7.5;
/** The speed the scenario's stored leg times assume. */
export const BASELINE_MPH = 65;

export function loadedMassKg(vehicle: Vehicle, payloadLb: number): number {
  return (vehicle.curbLb + payloadLb) * LB_PER_KG;
}

function rollingForceN(vehicle: Vehicle, massKg: number): number {
  return vehicle.rollingResistance * massKg * G;
}

function aeroForceN(vehicle: Vehicle, mph: number): number {
  const v = mph * MPS_PER_MPH;
  return 0.5 * AIR_DENSITY * vehicle.dragCoefficient * vehicle.frontalAreaM2 * v * v;
}

/**
 * Consumption from the road-load equation, calibrated so the published EPA range is
 * what the default load draws at the baseline speed. Rolling resistance rises with
 * load; drag rises with the square of speed.
 */
export function whPerMile(vehicle: Vehicle, defaultPayloadLb: number, payloadLb: number, mph: number): number {
  const refWhPerMi = (vehicle.batteryKwh * 1000) / vehicle.epaRangeMi;
  const refMass = loadedMassKg(vehicle, defaultPayloadLb);
  const here = rollingForceN(vehicle, loadedMassKg(vehicle, payloadLb)) + aeroForceN(vehicle, mph);
  const ref = rollingForceN(vehicle, refMass) + aeroForceN(vehicle, BASELINE_MPH);
  return refWhPerMi * (here / ref);
}

export function rangeMi(vehicle: Vehicle, defaultPayloadLb: number, payloadLb: number, mph: number): number {
  return (vehicle.batteryKwh * 1000) / whPerMile(vehicle, defaultPayloadLb, payloadLb, mph);
}

/** Range you can actually spend, given a floor you refuse to go below. */
export function usableRangeMi(fullRangeMi: number, reservePct: number): number {
  return fullRangeMi * ((100 - reservePct) / 100);
}

/**
 * Miles of flat-road range equivalent to lifting the car 1,000 ft, or recovered by
 * dropping it. Expressed in miles at the consumption the car is currently running,
 * so the figure falls as the cost per mile rises.
 */
export function milesPer1000ft(
  vehicle: Vehicle,
  defaultPayloadLb: number,
  payloadLb: number,
  mph: number,
  direction: 'climb' | 'descend',
): number {
  const joules = loadedMassKg(vehicle, payloadLb) * G * (1000 / FEET_PER_METRE);
  const kwhRaw = joules / 3.6e6;
  const kwh =
    direction === 'climb'
      ? kwhRaw / (vehicle.climbEfficiency * vehicle.drivetrainEfficiency)
      : kwhRaw * vehicle.regenRecovery;
  return (kwh * 1000) / whPerMile(vehicle, defaultPayloadLb, payloadLb, mph);
}

export function legHours(leg: Leg, avgSpeedMph: number): number {
  return (leg.minutes / 60) * (BASELINE_MPH / avgSpeedMph);
}

export interface LegEnergy {
  /** Miles of range the climb costs beyond flat ground. */
  climbCostMi: number;
  /** Miles of range regen hands back on the descent. */
  regenMi: number;
  /** Miles of flat road this leg consumes the equivalent of. */
  effectiveMi: number;
}

export function legEnergy(
  leg: Leg,
  vehicle: Vehicle,
  defaultPayloadLb: number,
  settings: Pick<TripSettings, 'payloadLb' | 'avgSpeedMph'>,
): LegEnergy {
  const delta = leg.elevation.endFt - leg.elevation.startFt;
  const perK = (dir: 'climb' | 'descend') =>
    milesPer1000ft(vehicle, defaultPayloadLb, settings.payloadLb, settings.avgSpeedMph, dir);
  const climbCostMi = delta > 0 ? (delta / 1000) * perK('climb') : 0;
  const regenMi = delta < 0 ? (Math.abs(delta) / 1000) * perK('descend') : 0;
  return { climbCostMi, regenMi, effectiveMi: leg.miles + climbCostMi - regenMi };
}

/** The legs a variant actually drives, in order. */
export function legsFor(scenario: Scenario, includeBranch: boolean): Leg[] {
  return [...scenario.legs, ...(includeBranch ? scenario.branchLegs : scenario.finalLegs)];
}

export interface Schedule {
  /** Day index from departure, keyed by leg id. */
  dayOffsets: Record<string, number>;
  dates: Record<string, Date>;
  totalDays: number;
}

/**
 * Walks the route leg by leg, capping a driving day at MAX_DRIVE_HOURS and holding
 * for the chosen number of nights at each overnight stop.
 */
export function buildSchedule(legs: Leg[], nights: number, avgSpeedMph: number, startDate: Date | null): Schedule {
  let day = 0;
  let hours = 0;
  const dayOffsets: Record<string, number> = {};

  for (const leg of legs) {
    hours += legHours(leg, avgSpeedMph);
    while (hours > MAX_DRIVE_HOURS) {
      day += 1;
      hours -= MAX_DRIVE_HOURS;
    }
    dayOffsets[leg.id] = day;
    if (leg.overnight) {
      day += nights;
      hours = 0;
    }
  }

  const dates: Record<string, Date> = {};
  if (startDate) {
    for (const [id, offset] of Object.entries(dayOffsets)) {
      const d = new Date(startDate.getTime());
      d.setDate(d.getDate() + offset);
      dates[id] = d;
    }
  }
  return { dayOffsets, dates, totalDays: day + 1 };
}

export interface TripTotals {
  flatMi: number;
  effectiveMi: number;
  climbTaxMi: number;
  wheelHours: number;
  chargingStops: number;
  parkCount: number;
  overnightStops: number;
  rangeMi: number;
  usableMi: number;
  whPerMile: number;
  /** The interval actually planned, never more than the reserve allows. */
  planIntervalMi: number;
  intervalClamped: boolean;
}

export function computeTotals(scenario: Scenario, settings: TripSettings): TripTotals {
  const legs = legsFor(scenario, settings.includeBranch);
  const { vehicle, defaults } = scenario;

  const full = rangeMi(vehicle, defaults.payloadLb, settings.payloadLb, settings.avgSpeedMph);
  const usable = usableRangeMi(full, settings.reservePct);
  const planInterval = Math.min(settings.cadenceMi, usable);

  let flatMi = 0;
  let effectiveMi = 0;
  let wheelHours = 0;
  let chargingStops = 0;
  let overnightStops = 0;
  const parks = new Set<string>();

  for (const leg of legs) {
    const energy = legEnergy(leg, vehicle, defaults.payloadLb, settings);
    flatMi += leg.miles;
    effectiveMi += energy.effectiveMi;
    wheelHours += legHours(leg, settings.avgSpeedMph);
    chargingStops += Math.max(0, Math.ceil(energy.effectiveMi / planInterval) - 1);
    if (leg.overnight) overnightStops += 1;
    if (leg.parkId) parks.add(leg.parkId);
  }

  return {
    flatMi,
    effectiveMi,
    climbTaxMi: effectiveMi - flatMi,
    wheelHours,
    chargingStops,
    parkCount: parks.size,
    overnightStops,
    rangeMi: full,
    usableMi: usable,
    whPerMile: whPerMile(vehicle, defaults.payloadLb, settings.payloadLb, settings.avgSpeedMph),
    planIntervalMi: planInterval,
    intervalClamped: settings.cadenceMi > usable,
  };
}

/** The first charger gap that will not fit inside the usable range, if any. */
export function failingGap(gaps: ChargerGap[], usableMi: number): ChargerGap | null {
  return gaps.find((g) => g.miles > usableMi) ?? null;
}

export function longestGap(gaps: ChargerGap[]): ChargerGap | null {
  return gaps.reduce<ChargerGap | null>((best, g) => (!best || g.miles > best.miles ? g : best), null);
}

export interface RoadStatus {
  season: RoadSeason;
  open: boolean;
  window: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function label(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

export function roadStatus(season: RoadSeason, date: Date | undefined): RoadStatus | null {
  if (!date) return null;
  const year = date.getFullYear();
  const [fm, fd] = season.from.split('-').map(Number);
  const [tm, td] = season.to.split('-').map(Number);
  const from = new Date(year, (fm ?? 1) - 1, fd ?? 1);
  const to = new Date(year, (tm ?? 1) - 1, td ?? 1);
  return { season, open: date >= from && date <= to, window: `${label(season.from)} to ${label(season.to)}` };
}

export const lapseAdjustmentF = (liftFt: number): number => (liftFt / 1000) * LAPSE_F_PER_1000FT;

export { METRES_PER_MILE };
