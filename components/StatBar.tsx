'use client';

import { fmtHours, mi } from '@/lib/format';
import type { Scenario } from '@/lib/types';
import type { TripState } from './useTrip';

export function StatBar({ scenario, trip }: { scenario: Scenario; trip: TripState }) {
  const { totals, schedule } = trip;
  const stats: [string, string][] = [
    [mi(totals.flatMi), trip.settings.includeBranch ? 'With the branch' : 'Direct route'],
    [fmtHours(totals.wheelHours), 'Wheel time'],
    [String(totals.parkCount), 'National & state parks'],
    [String(scenario.statesCrossed), 'States crossed'],
    [String(schedule.totalDays), 'Days at these settings'],
  ];

  return (
    <div className="statbar">
      {stats.map(([value, label]) => (
        <div className="stat" key={label}>
          <div className="n">{value}</div>
          <div className="l">{label}</div>
        </div>
      ))}
    </div>
  );
}
