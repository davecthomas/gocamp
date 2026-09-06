'use client';

import Link from 'next/link';
import type { Scenario } from '@/lib/types';
import { StatBar } from './StatBar';
import { TripSettingsPanel } from './TripSettingsPanel';
import { useTrip } from './useTrip';

export function ScenarioView({ scenario }: { scenario: Scenario }) {
  const trip = useTrip(scenario);

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">
          <Link href="/" className="backlink">
            All scenarios
          </Link>
          <span aria-hidden="true"> · </span>
          {scenario.eyebrow} · {scenario.name}
        </div>
        <h1>{scenario.headline}</h1>
        <p className="dek">{scenario.summary}</p>
        <StatBar scenario={scenario} trip={trip} />
      </header>

      <div className="section-head">
        <h2>Trip settings</h2>
        <span className="tag">everything below reacts to these</span>
      </div>
      <TripSettingsPanel scenario={scenario} trip={trip} />
    </div>
  );
}
