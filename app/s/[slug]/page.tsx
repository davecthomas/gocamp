import { notFound } from 'next/navigation';
import { ScenarioView } from '@/components/ScenarioView';
import { getScenario, getScenarioSlugs } from '@/lib/scenarios';

export function generateStaticParams() {
  return getScenarioSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) return {};
  return { title: `${scenario.name} — ${scenario.headline}`, description: scenario.summary };
}

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) notFound();
  return <ScenarioView scenario={scenario} />;
}
