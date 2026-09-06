'use client';

import { useMemo, useState } from 'react';
import { parseDateInput } from '@/lib/format';
import { buildSchedule, computeTotals, legsFor } from '@/lib/trip';
import type { Scenario, TripSettings } from '@/lib/types';

/**
 * Single source of truth for a scenario's interactive state. Everything the page
 * shows is derived here, so a settings change cannot leave part of the page stale
 * the way the old imperative recompute could.
 */
export function useTrip(scenario: Scenario) {
  const [settings, setSettings] = useState<TripSettings>({ ...scenario.defaults });

  const derived = useMemo(() => {
    const legs = legsFor(scenario, settings.includeBranch);
    const totals = computeTotals(scenario, settings);
    const startDate = parseDateInput(settings.startDate);
    const schedule = buildSchedule(legs, settings.nights, settings.avgSpeedMph, startDate);

    let arrival: Date | null = null;
    if (startDate) {
      arrival = new Date(startDate.getTime());
      arrival.setDate(arrival.getDate() + schedule.totalDays - 1);
    }
    return { legs, totals, schedule, startDate, arrival };
  }, [scenario, settings]);

  function update<K extends keyof TripSettings>(key: K, value: TripSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  /** Setting the arrival moves the departure, keeping the trip length the settings imply. */
  function setArrival(value: string) {
    const end = parseDateInput(value);
    if (!end) return;
    const start = new Date(end.getTime());
    start.setDate(start.getDate() - (derived.schedule.totalDays - 1));
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    update('startDate', `${start.getFullYear()}-${m}-${d}`);
  }

  return { settings, update, setArrival, ...derived };
}

export type TripState = ReturnType<typeof useTrip>;
