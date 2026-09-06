import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { Scenario } from './types';

const SCENARIO_DIR = path.join(process.cwd(), 'scenarios');

/**
 * Validates the shape a scenario YAML must satisfy. This runs at build time, so a
 * malformed scenario fails the build with the field named rather than rendering a
 * broken page. Cheap hand-rolled checks beat a schema dependency for one file type.
 */
function validate(raw: unknown, file: string): Scenario {
  const fail = (msg: string): never => {
    throw new Error(`${file}: ${msg}`);
  };
  if (typeof raw !== 'object' || raw === null) return fail('not an object');
  const s = raw as Record<string, unknown>;

  for (const key of ['slug', 'name', 'headline', 'summary'] as const) {
    if (typeof s[key] !== 'string' || !s[key]) fail(`${key} must be a non-empty string`);
  }
  for (const key of ['legs', 'finalLegs', 'branchLegs', 'roadSeasons', 'mapStops', 'chargers', 'chargerGaps'] as const) {
    if (!Array.isArray(s[key])) fail(`${key} must be an array`);
  }
  if (!Array.isArray(s.legs) || s.legs.length === 0) fail('legs must not be empty');

  const seen = new Set<string>();
  for (const group of [s.legs, s.finalLegs, s.branchLegs] as unknown[][]) {
    for (const item of group) {
      const leg = item as Record<string, unknown>;
      if (typeof leg.id !== 'string') fail('every leg needs an id');
      if (seen.has(leg.id as string)) fail(`duplicate leg id ${leg.id}`);
      seen.add(leg.id as string);
      if (typeof leg.miles !== 'number' || leg.miles < 0) fail(`leg ${leg.id}: miles must be a number`);
      if (typeof leg.minutes !== 'number' || leg.minutes < 0) fail(`leg ${leg.id}: minutes must be a number`);
      const elev = leg.elevation as Record<string, unknown> | undefined;
      if (!elev || typeof elev.startFt !== 'number' || typeof elev.endFt !== 'number') {
        fail(`leg ${leg.id}: elevation needs startFt and endFt`);
      }
    }
  }

  const geo = s.geometry as Record<string, unknown> | undefined;
  if (!geo || !Array.isArray(geo.main) || geo.main.length < 2) fail('geometry.main needs at least two points');

  if (s.branch && (!Array.isArray(s.branchLegs) || s.branchLegs.length === 0)) {
    fail('a scenario declaring a branch needs branchLegs');
  }
  return s as unknown as Scenario;
}

function read(file: string): Scenario {
  const parsed = YAML.parse(fs.readFileSync(path.join(SCENARIO_DIR, file), 'utf8'));
  return validate(parsed, file);
}

export function listScenarioFiles(): string[] {
  if (!fs.existsSync(SCENARIO_DIR)) return [];
  return fs.readdirSync(SCENARIO_DIR).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
}

export function getAllScenarios(): Scenario[] {
  return listScenarioFiles().map(read);
}

export function getScenarioSlugs(): string[] {
  return getAllScenarios().map((s) => s.slug);
}

export function getScenario(slug: string): Scenario | null {
  return getAllScenarios().find((s) => s.slug === slug) ?? null;
}
