# Decision notes 2026-09-06

## 2026-09-06T14:24Z · davecthomas · feature/next-map

**Decision:** Map, proxy route handler, and a thorough test pass
**Why:** Ports the Mapbox map to a client component behind next/dynamic, since GL JS touches window at import time. Route, stops and the 111 chargers become map layers; charger names appear past zoom 8; stop popups carry date, weather, dog rules and links. A nine-second load guard falls back rather than leaving an empty frame (ADR-0006). Moves the proxy to app/api/mapbox/route.ts, with its URL policy extracted to lib/mapbox-proxy.ts so the security properties can be asserted rather than assumed (ADR-0001). Every fourth PR gets a wider sweep, so this one adds 25 tests and the suite goes from 23 to 48. They caught two real defects: Proxy verified end to end: 503 without a token, 400 for a disallowed host, 400 for the account API, 400 for a missing target.
**Commit:** 23acf65
**Source:** commit-capture

## 2026-09-06T14:27Z · davecthomas · feature/next-cutover

**Decision:** Cut production over to Next.js and retire the static site
**Why:** Removes public/ and api/mapbox.js, and points vercel.json at the nextjs framework instead of the no-op build command that was overriding a stale dashboard setting. Adds a permanent redirect from /index.html to /. The Next.js app now serves everything: the scenario index, the prerendered scenario page, and the Mapbox proxy as a route handler.
**Commit:** db67432
**Source:** commit-capture

