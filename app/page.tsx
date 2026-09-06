import Link from 'next/link';
import { getAllScenarios } from '@/lib/scenarios';
import { computeTotals } from '@/lib/trip';

export default function Home() {
  const scenarios = getAllScenarios();

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Route scenarios</div>
        <h1>Camping routes, planned properly</h1>
        <p className="dek">
          Each scenario is a route built around the parks it passes, with the driving, charging,
          weather and paperwork worked out for a specific vehicle and a specific departure date.
        </p>
      </header>

      <div className="scenario-grid">
        {scenarios.map((scenario) => {
          const totals = computeTotals(scenario, scenario.defaults);
          return (
            <Link key={scenario.slug} href={`/s/${scenario.slug}`} className="scenario-card">
              <div className="eyebrow">{scenario.eyebrow}</div>
              <h2>{scenario.name}</h2>
              <p className="scenario-headline">{scenario.headline}</p>
              <div className="scenario-stats">
                <span>
                  <b>{Math.round(totals.flatMi).toLocaleString()}</b> mi
                </span>
                <span>
                  <b>{totals.parkCount}</b> parks
                </span>
                <span>
                  <b>{scenario.statesCrossed}</b> states
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {scenarios.length === 0 && (
        <p className="dek">
          No scenarios yet. Add a YAML file under <code>scenarios/</code> to create one.
        </p>
      )}
    </div>
  );
}
