'use client';

import Link from 'next/link';
import type { Scenario } from '@/lib/types';
import { StatBar } from './StatBar';
import { StopList } from './StopList';
import { TripSettingsPanel } from './TripSettingsPanel';
import { useTrip } from './useTrip';

export function ScenarioView({ scenario }: { scenario: Scenario }) {
  const trip = useTrip(scenario);

  // Named in route order, so the sequence reads as the trip is actually driven.
  const parkSequence = trip.legs
    .filter((leg) => leg.parkId)
    .map((leg) => leg.badge.text)
    .join(' → ');

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

      <div className="section-head">
        <h2>The parks, in order</h2>
        <span className="tag">{parkSequence}</span>
      </div>
      <StopList scenario={scenario} trip={trip} />
    </div>
  );
}
