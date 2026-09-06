'use client';

import type { Callout, Scenario } from '@/lib/types';
import { Collapsible } from './Collapsible';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Scenario prose carries inline markup (bold, arrows) authored in the YAML, so it
 * is injected rather than escaped. The source is a repo file, not user input.
 */
function Html({ html, className }: { html: string; className?: string }) {
  return <p className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CalloutBlock({ callout }: { callout: Callout }) {
  return (
    <Collapsible title={callout.title} className={`callout ${callout.tone}`}>
      {callout.paragraphs.map((paragraph, i) => (
        <Html key={i} html={paragraph} />
      ))}
    </Collapsible>
  );
}

export function SeasonWindows({ scenario }: { scenario: Scenario }) {
  const { seasonWindows } = scenario.content;
  if (seasonWindows.length === 0) return null;

  return (
    <>
      <div className="section-head">
        <h2>Seasonal road windows</h2>
        <span className="tag">plowing progress sets both opening dates</span>
      </div>
      <div className="seasons">
        {seasonWindows.map((window) => (
          <div className="season-row" key={window.name}>
            <div className="season-label">
              {window.name}
              <br />
              <span style={{ color: 'var(--ink-soft)', fontSize: '.72rem' }}>{window.detail}</span>
            </div>
            <div className="season-track">
              <div
                className="season-bar"
                style={{ left: `${window.leftPct}%`, width: `${window.widthPct}%` }}
                aria-label={`${window.name} open season`}
              />
            </div>
          </div>
        ))}
        <div className="months">
          <div />
          <div className="monthlabels">
            {MONTHS.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function PassesAndFees({ scenario }: { scenario: Scenario }) {
  const { fees } = scenario.content;
  if (fees.length === 0) return null;

  return (
    <>
      <div className="section-head">
        <h2>Passes and fees</h2>
        <span className="tag">one federal pass, three state gates</span>
      </div>
      <div className="feewrap">
        <table className="fees">
          <thead>
            <tr>
              <th>Stop</th>
              <th>Gate fee, out-of-state vehicle</th>
              <th>America the Beautiful</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => (
              <tr key={fee.stop}>
                <td className="stop">{fee.stop}</td>
                <td className="cost">{fee.fee}</td>
                <td>
                  <span className={`cov ${fee.covered ? 'yes' : 'no'}`}>{fee.coverLabel}</span>
                </td>
                <td>
                  <a href={fee.url} target="_blank" rel="noopener">
                    {fee.linkLabel} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Checklist({ scenario }: { scenario: Scenario }) {
  const { checklist } = scenario.content;
  if (checklist.length === 0) return null;

  return (
    <>
      <div className="section-head">
        <h2>Book-ahead checklist</h2>
        <span className="tag">the parts that sell out first</span>
      </div>
      <div className="checklist">
        {checklist.map((group) => (
          <Collapsible key={group.title} title={group.title} className="check">
            <ul>
              {group.items.map((item, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
              ))}
            </ul>
          </Collapsible>
        ))}
      </div>
    </>
  );
}

export function SourcesFooter({ scenario }: { scenario: Scenario }) {
  return (
    <footer>
      <Collapsible title="Data sources and caveats">
        {scenario.content.sourcesAndCaveats.map((paragraph, i) => (
          <Html key={i} html={paragraph} />
        ))}
      </Collapsible>
    </footer>
  );
}
