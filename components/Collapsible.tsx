'use client';

/** Titled prose blocks collapse by default; the title is always what you see first. */
export function Collapsible({
  title,
  className = 'fine',
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={className}>
      <summary>{title}</summary>
      <div className={className === 'check' ? 'check-body' : className === 'fine' ? 'fine-body' : 'callout-body'}>
        {children}
      </div>
    </details>
  );
}
