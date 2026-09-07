import { describe, expect, it } from 'vitest';
import { getScenario } from '../lib/scenarios';
import { chargerNeighbours, greatCircleMi, projectOntoLine } from '../lib/route';

const scenario = getScenario('rockies-line')!;

describe('distance along the route', () => {
  it('measures a great circle against a known separation', () => {
    // Rawlins to Jackson, straight line. Checked against an independent calculation.
    expect(greatCircleMi([41.7908, -107.21], [43.4638, -110.7954])).toBeCloseTo(216, 0);
  });

  it('projects a point onto the line it sits on', () => {
    const line: [number, number][] = [
      [40, -105],
      [41, -105],
    ];
    // Due east of the midpoint: on the line at halfway, and a little to the side.
    const { offMi, alongMi } = projectOntoLine(line, [40.5, -104.9]);
    expect(alongMi).toBeCloseTo(greatCircleMi(line[0]!, line[1]!) / 2, 0);
    expect(offMi).toBeGreaterThan(0);
    expect(offMi).toBeLessThan(6);
  });

  it('puts an endpoint at zero along and zero off', () => {
    const line: [number, number][] = [
      [40, -105],
      [41, -105],
    ];
    expect(projectOntoLine(line, [40, -105]).alongMi).toBeCloseTo(0, 3);
    expect(projectOntoLine(line, [40, -105]).offMi).toBeCloseTo(0, 3);
  });
});

/**
 * The neighbour distances a charger popup reports. The scenario records its own
 * worst gaps, computed the same way when the data was built, so those are the
 * fixed point this is checked against.
 */
describe('charger neighbours', () => {
  const neighbours = chargerNeighbours(scenario);

  it('covers every charger', () => {
    expect(neighbours.size).toBe(scenario.chargers.length);
  });

  it('agrees with the worst gap the scenario records', () => {
    // The recorded gaps skip chargers that sit close together, so only the long
    // ones line up pair for pair. This is the one the reserve check turns on.
    const worst = scenario.chargerGaps[0]!;
    const from = neighbours.get(worst.from);
    expect(from, `${worst.from} should be a known charger`).toBeDefined();
    expect(from!.next?.name).toBe(worst.to);
    expect(from!.next?.miles).toBeCloseTo(worst.miles, 0);
  });

  it('never reports two chargers as touching, however coarse the geometry', () => {
    // Several metro chargers project onto one segment, so the along-route
    // difference alone would report them as zero apart.
    for (const [name, n] of neighbours) {
      for (const side of [n.previous, n.next]) {
        // Two Ellensburg sites really do sit about 470 feet apart, so the floor
        // is only that no pair collapses to nothing.
        if (side) expect(side.miles, name).toBeGreaterThan(0);
      }
    }
  });

  it('reports the same distance from both sides of a pair', () => {
    for (const [name, n] of neighbours) {
      if (!n.next) continue;
      const other = neighbours.get(n.next.name)!;
      expect(other.previous?.name, name).toBe(name);
      expect(other.previous?.miles, name).toBeCloseTo(n.next.miles, 6);
    }
  });

  it('leaves the ends of each run open', () => {
    const noPrevious = [...neighbours.values()].filter((n) => !n.previous);
    const noNext = [...neighbours.values()].filter((n) => !n.next);
    // One head and one tail per drawn line.
    const runs = Object.values(scenario.geometry).filter((l) => l.length > 1).length;
    expect(noPrevious).toHaveLength(runs);
    expect(noNext).toHaveLength(runs);
  });

  it('never reports a negative or absurd distance', () => {
    for (const [name, n] of neighbours) {
      for (const side of [n.previous, n.next]) {
        if (!side) continue;
        expect(side.miles, name).toBeGreaterThan(0);
        expect(side.miles, name).toBeLessThan(400);
      }
    }
  });
});
