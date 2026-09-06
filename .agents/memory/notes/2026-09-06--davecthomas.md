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

## 2026-09-06T18:32Z · davecthomas · feature/rename-gocamp

**Decision:** Rename the app to GoCamp
**Why:** Rockies Line named the app after its one scenario. Now that more are coming, the app needs a name that isn't tied to a route. Title metadata uses a template, 'GoCamp' by default and '<headline> · GoCamp' per scenario, so a page's tab reads e.g. 'Austin to Seattle, park to park · GoCamp' without every scenario needing to repeat the app name itself. The scenario stays named The Rockies Line — that's the route, not the app, and lives in scenarios/rockies-line.yaml rather than in any branding. package.json, the proxy's user-agent string, and the README are updated. The GitHub repo, the Vercel project, and the rockies-line.vercel.app URL keep the old name for now; renaming those changes a live URL and is a separate step, noted in the README.
**Commit:** 2b8a5fa
**Source:** commit-capture

## 2026-09-06T19:23Z · davecthomas · feature/hero-shots

**Decision:** Add a hero photo to every stop
**Why:** Each of the 13 stops gets a landscape photo of the place it actually is: Palo Duro Canyon, Golden Gate Canyon aspen, Moraine Park, Trail Ridge Road above treeline, Grand Lake, the Gros Ventre River, Jenny Lake, the Lower Falls, the Madison River, Bozeman, Missoula, the Spokane skyline and Seattle. Sourced from Wikimedia Commons, restricted to licences that permit reuse with attribution (CC BY, CC BY-SA, CC0, public domain). The photographer, the licence and a link to the source page come back from the same API response that supplied the file, are stored on the leg in the scenario YAML, and are rendered over the image. Nothing is used whose licence could not be read programmatically. Images are self-hosted rather than hotlinked, standardised to a 1400x600 band and re-encoded, which is both a consistent card layout and 3.3 MB for all thirteen. A test asserts every hero has a credit, a licence on the permitted list, an https source, and a file that actually exists in public/.
**Commit:** 8c94a25
**Source:** commit-capture

