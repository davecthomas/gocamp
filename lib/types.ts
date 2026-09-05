/** A scenario is data. These types are the contract its YAML file must satisfy. */

export type BadgeKind = 'np' | 'sp' | 'nf' | 'city';
export type DogLevel = 'good' | 'restricted';
export type StopKind = 'start' | 'end' | 'np' | 'sp' | 'nf' | 'city' | 'fork';

export interface StopLink {
  label: string;
  url: string;
  /** Rendered as a primary action rather than a plain link. */
  reserve?: boolean;
}

export interface Leg {
  id: string;
  from: string;
  to: string;
  title: string;
  miles: number;
  /** Drive time at the scenario's baseline speed, which the speed setting scales. */
  minutes: number;
  elevation: { startFt: number; endFt: number };
  badge: { kind: BadgeKind; text: string };
  note: string;
  dog: { level: DogLevel; note: string };
  /** Marks the end of a driving day, which is what the nights setting multiplies. */
  overnight?: boolean;
  /** Present when this leg is the scenario's single entry for a distinct park. */
  parkId?: string;
  camp?: string;
  /** Key into the shared climate normals. */
  station?: string;
  /** Feet this stop sits above its weather station, corrected by lapse rate. */
  stationLiftFt?: number;
  links?: StopLink[];
}

export interface Vehicle {
  name: string;
  batteryKwh: number;
  epaRangeMi: number;
  curbLb: number;
  dragCoefficient: number;
  frontalAreaM2: number;
  rollingResistance: number;
  drivetrainEfficiency: number;
  climbEfficiency: number;
  regenRecovery: number;
  fastChargeNote: string;
  port: string;
  sourceNote: string;
}

export interface ScenarioDefaults {
  cadenceMi: number;
  nights: number;
  avgSpeedMph: number;
  payloadLb: number;
  reservePct: number;
  /** ISO date, the day you leave the first stop. */
  startDate: string;
  includeBranch: boolean;
}

export interface RoadSeason {
  /** The leg this window gates. */
  legId: string;
  name: string;
  /** MM-DD. Alpine roads open on plowing progress, so these are typical seasons. */
  from: string;
  to: string;
  summitFt?: number;
}

export type LatLon = [number, number];

export interface MapStop {
  id: string;
  label: string;
  lat: number;
  lon: number;
  kind: StopKind;
}

export interface Charger {
  name: string;
  lat: number;
  lon: number;
  stalls: number;
  kw: number;
}

/** Measured distance between two consecutive chargers along the route. */
export interface ChargerGap {
  miles: number;
  from: string;
  to: string;
}

export interface Scenario {
  slug: string;
  name: string;
  eyebrow: string;
  headline: string;
  summary: string;
  statesCrossed: number;
  vehicle: Vehicle;
  defaults: ScenarioDefaults;
  payloadBreakdown: { adults: number; dog: number; gear: number };
  branch?: { id: string; label: string; sublabel: string };
  /** Legs common to every variant, in order. */
  legs: Leg[];
  /** Legs used when the branch is off. */
  finalLegs: Leg[];
  /** Legs used when the branch is on, replacing finalLegs. */
  branchLegs: Leg[];
  roadSeasons: RoadSeason[];
  geometry: { main: LatLon[]; direct: LatLon[]; branch: LatLon[] };
  mapStops: MapStop[];
  chargers: Charger[];
  chargerGaps: ChargerGap[];
  content: ScenarioContent;
}

/** The settings a visitor can change. Everything derived flows from these. */
export interface TripSettings {
  cadenceMi: number;
  nights: number;
  avgSpeedMph: number;
  payloadLb: number;
  reservePct: number;
  startDate: string;
  includeBranch: boolean;
}

/** A weather station's monthly normals: [meanHighF, meanLowF, precipInches]. */
export interface ClimateStation {
  name: string;
  months: [number, number, number][];
}

export interface Callout {
  tone: 'clay' | 'alpine';
  title: string;
  paragraphs: string[];
}

export interface ChecklistGroup {
  title: string;
  items: string[];
}

export interface FeeRow {
  stop: string;
  fee: string;
  covered: boolean;
  coverLabel: string;
  url: string;
  linkLabel: string;
}

export interface SeasonWindow {
  name: string;
  detail: string;
  leftPct: number;
  widthPct: number;
}

export interface ScenarioContent {
  callouts: Callout[];
  checklist: ChecklistGroup[];
  fees: FeeRow[];
  seasonWindows: SeasonWindow[];
  sourcesAndCaveats: string[];
  howComputed: string[];
}
