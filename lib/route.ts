/**
 * Where things sit along the drawn route (ADR-0003: the maths is pure and lives
 * apart from rendering).
 *
 * A charger's useful neighbours are the ones a driver meets before and after it,
 * which is an ordering along the line rather than by straight-line proximity. So
 * each charger is projected onto the geometry, ordered by how far along it falls,
 * and measured against the chargers either side of it.
 */
import type { LatLon, Scenario } from './types';

const EARTH_RADIUS_MI = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles. */
export function greatCircleMi(a: LatLon, b: LatLon): number {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/**
 * Closest point on one segment, in miles off it and the fraction along it.
 *
 * Flat maths on a local projection. Over a segment of this length the error is
 * far below the mile these numbers are reported to.
 */
function projectOntoSegment(point: LatLon, a: LatLon, b: LatLon): { offMi: number; t: number } {
  const latRef = toRad((a[0] + b[0]) / 2);
  const xy = (p: LatLon): [number, number] => [
    toRad(p[1]) * Math.cos(latRef) * EARTH_RADIUS_MI,
    toRad(p[0]) * EARTH_RADIUS_MI,
  ];
  const [px, py] = xy(point);
  const [ax, ay] = xy(a);
  const [bx, by] = xy(b);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return { offMi: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

/** Where a point falls on a polyline: how far off it sits, and how far along. */
export function projectOntoLine(line: LatLon[], point: LatLon): { offMi: number; alongMi: number } {
  let best = { offMi: Infinity, alongMi: 0 };
  let travelled = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    const segment = greatCircleMi(line[i]!, line[i + 1]!);
    const { offMi, t } = projectOntoSegment(point, line[i]!, line[i + 1]!);
    if (offMi < best.offMi) best = { offMi, alongMi: travelled + t * segment };
    travelled += segment;
  }
  return best;
}

/** The charger a driver meets before this one, and the one after, with distances. */
export interface ChargerNeighbours {
  previous?: { name: string; miles: number };
  next?: { name: string; miles: number };
}

/**
 * Neighbour distances for every charger, keyed by name.
 *
 * A charger belongs to whichever drawn line it sits closest to, and is ordered
 * against the others on that line. The park route, the direct comparison and the
 * branch are separate runs of road, so a charger on one has no neighbour on
 * another.
 */
export function chargerNeighbours(scenario: Scenario): Map<string, ChargerNeighbours> {
  const lines = Object.values(scenario.geometry).filter((line) => line.length > 1);
  const placed = scenario.chargers.map((charger) => {
    let best = { line: -1, offMi: Infinity, alongMi: 0 };
    lines.forEach((line, index) => {
      const { offMi, alongMi } = projectOntoLine(line, [charger.lat, charger.lon]);
      if (offMi < best.offMi) best = { line: index, offMi, alongMi };
    });
    return { name: charger.name, point: [charger.lat, charger.lon] as LatLon, ...best };
  });

  const out = new Map<string, ChargerNeighbours>();
  for (let index = 0; index < lines.length; index += 1) {
    const run = placed.filter((p) => p.line === index).sort((a, b) => a.alongMi - b.alongMi);
    run.forEach((charger, i) => {
      const previous = run[i - 1];
      const next = run[i + 1];
      out.set(charger.name, {
        ...(previous ? { previous: { name: previous.name, miles: separationMi(previous, charger) } } : {}),
        ...(next ? { next: { name: next.name, miles: separationMi(charger, next) } } : {}),
      });
    });
  }
  return out;
}

/**
 * How far apart two neighbours are, as a lower bound on the driving distance.
 *
 * The along-route difference follows the road corridor and is the better figure
 * over any real distance. It collapses at close range, though: this geometry is
 * 37 points across 2,399 miles, so several chargers in one metro land on a single
 * segment and their difference falls to nothing. Two Austin sites came out 0 miles
 * apart. Driving distance is never shorter than the straight line between them,
 * so the larger of the two is the honest number to report.
 */
function separationMi(
  a: { name: string; alongMi: number; point: LatLon },
  b: { name: string; alongMi: number; point: LatLon },
): number {
  return Math.max(b.alongMi - a.alongMi, greatCircleMi(a.point, b.point));
}
