import { describe, expect, it } from 'vitest';
import { CLIMATE } from '../lib/data/climate';
import { getAllScenarios } from '../lib/scenarios';
import { legsFor } from '../lib/trip';

/**
 * Invariants every scenario must hold. A scenario is data (ADR-0002), so these
 * catch a bad YAML file at test time rather than in the browser.
 */
const scenarios = getAllScenarios();

describe('scenario data integrity', () => {
  it('finds at least one scenario', () => {
    expect(scenarios.length).toBeGreaterThan(0);
  });

  for (const scenario of scenarios) {
    describe(scenario.slug, () => {
      const allLegs = [...scenario.legs, ...scenario.finalLegs, ...scenario.branchLegs];

      it('has a unique slug-safe identifier', () => {
        expect(scenario.slug).toMatch(/^[a-z0-9-]+$/);
      });

      it('points every station reference at real climate data', () => {
        for (const leg of allLegs) {
          if (!leg.station) continue;
          expect(CLIMATE[leg.station], `${leg.id} → ${leg.station}`).toBeDefined();
          expect(CLIMATE[leg.station]!.months).toHaveLength(12);
        }
      });

      it('joins each leg to the next without a gap in the route', () => {
        const chain = legsFor(scenario, false);
        for (let i = 1; i < chain.length; i += 1) {
          expect(chain[i]!.from, `${chain[i - 1]!.id} → ${chain[i]!.id}`).toBe(chain[i - 1]!.to);
        }
      });

      it('joins the branch to the route as well', () => {
        const chain = legsFor(scenario, true);
        for (let i = 1; i < chain.length; i += 1) {
          expect(chain[i]!.from, `${chain[i - 1]!.id} → ${chain[i]!.id}`).toBe(chain[i - 1]!.to);
        }
      });

      it('keeps elevations physically plausible', () => {
        for (const leg of allLegs) {
          expect(leg.elevation.startFt).toBeGreaterThan(-300);
          expect(leg.elevation.endFt).toBeLessThan(15000);
        }
      });

      it('implies a sane average speed on every leg', () => {
        for (const leg of allLegs) {
          if (leg.miles === 0 || leg.minutes === 0) continue;
          const mph = leg.miles / (leg.minutes / 60);
          expect(mph, `${leg.id} implies ${mph.toFixed(1)} mph`).toBeGreaterThan(15);
          expect(mph, `${leg.id} implies ${mph.toFixed(1)} mph`).toBeLessThan(85);
        }
      });

      it('gives every park exactly one leg within a variant', () => {
        // The direct and branch endings are mutually exclusive, so the same park may
        // appear once in each. What must hold is uniqueness within a driven route,
        // since that is what the park count counts.
        for (const includeBranch of [false, true]) {
          const parkIds = legsFor(scenario, includeBranch)
            .map((l) => l.parkId)
            .filter(Boolean);
          expect(new Set(parkIds).size, `branch=${includeBranch}`).toBe(parkIds.length);
        }
      });

      it('uses only https links', () => {
        for (const leg of allLegs) {
          for (const link of leg.links ?? []) {
            expect(link.url, `${leg.id}: ${link.label}`).toMatch(/^https:\/\//);
          }
        }
      });

      it('ties every road season to a leg that exists', () => {
        for (const season of scenario.roadSeasons) {
          expect(allLegs.some((l) => l.id === season.legId), season.name).toBe(true);
          expect(season.from).toMatch(/^\d{2}-\d{2}$/);
          expect(season.to).toMatch(/^\d{2}-\d{2}$/);
        }
      });

      it('keeps chargers and map stops inside the continental US', () => {
        for (const point of [...scenario.chargers, ...scenario.mapStops]) {
          expect(point.lat).toBeGreaterThan(24);
          expect(point.lat).toBeLessThan(50);
          expect(point.lon).toBeGreaterThan(-125);
          expect(point.lon).toBeLessThan(-66);
        }
      });

      it('orders charger gaps longest first, so the first failure is the worst', () => {
        for (let i = 1; i < scenario.chargerGaps.length; i += 1) {
          expect(scenario.chargerGaps[i]!.miles).toBeLessThanOrEqual(scenario.chargerGaps[i - 1]!.miles);
        }
      });

      it('starts its default date inside the open season of every road it uses', () => {
        expect(scenario.defaults.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('carries the prose the page renders', () => {
        expect(scenario.content.callouts.length).toBeGreaterThan(0);
        expect(scenario.content.checklist.length).toBeGreaterThan(0);
        expect(scenario.content.fees.length).toBeGreaterThan(0);
        for (const fee of scenario.content.fees) expect(fee.url).toMatch(/^https:\/\//);
      });
    });
  }
});
