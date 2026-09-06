import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'GoCamp', template: '%s · GoCamp' },
  description:
    'Camping route planner: park-to-park scenarios with per-stop dates, climate normals, dog rules, park passes and EV range maths.',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9B%BA%EF%B8%8F%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
        />
      </head>
      <body>
        {/* Topographic wash behind the page. Decorative, so it is hidden from readers. */}
        <svg className="contour" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <pattern id="topo" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 20 Q10 5 20 20 T40 20" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
              <path d="M0 30 Q10 18 20 30 T40 30" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.35" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#topo)" style={{ color: 'var(--ink)' }} />
        </svg>
        {children}
      </body>
    </html>
  );
}
