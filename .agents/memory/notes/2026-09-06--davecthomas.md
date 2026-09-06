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

## 2026-09-06T21:04Z · davecthomas · main

**Decision:** Rewrite TileJSON bodies in the Mapbox proxy and make every proxied URL absolute.
**Why:** Mapbox writes the account token into every entry of a TileJSON 'tiles' array, so streaming JSON through untouched handed the public browser the exact pk.* credential ADR-0001 exists to hide. Those same URLs were plaintext http on a/b.tiles.mapbox.com, which an https page blocks as mixed content and which transformRequest did not treat as a Mapbox host, so no base tile ever loaded and the map showed route and chargers over an empty frame. The route now rewrites tile templates to point at the proxy over https with the token stripped, scrubs the token from the serialized body as a last defence, lets 'secure' through so upstream returns https, and sends Vary: Host because the body names this deployment's origin. Separately, proxied() returns an absolute URL: GL JS fetches tiles from a worker built on a blob URL, a blob URL has an opaque path, so resolving '/api/mapbox' against it throws inside the worker and the request never leaves the browser (verified: blob worker throws on the relative form, 200 on the absolute one).
**Alternatives:** Leaving tile URLs as plain https api.mapbox.com and relying on transformRequest to proxy them at request time was rejected: it keeps a token-bearing body shape one upstream change away from leaking again, and the rewrite is what actually guarantees the credential never reaches the browser. Assigning mapboxgl.config.EVENTS_URL = null to silence the 503 telemetry posts was rejected because EVENTS_URL is a getter derived from API_URL, so assignment throws and takes the page down with a client-side exception; Object.defineProperty in a try/catch is used instead.
**Scope:** app/api/mapbox/route.ts, lib/mapbox-proxy.ts, components/MapView.tsx

## 2026-09-06T21:04Z · davecthomas · main

**Decision:** Check document.visibilityState before concluding a WebGL map is broken.
**Why:** A Chrome tab driven by browser automation is usually a background tab, and Chrome suspends requestAnimationFrame there. Mapbox GL only requests tiles from inside its render loop, so a hidden tab shows zero tile requests, style.loaded() stuck false, source caches left paused, and a permanently blank base map — regardless of whether the code is correct. This masqueraded as an application bug and cost real diagnosis time. The data path can still be verified without a visible tab by pumping the loop by hand with map._render(performance.now()) and then reading tile state off the source cache.
**Scope:** components/MapView.tsx

## 2026-09-06T21:12Z · davecthomas · fix/tilejson-token-leak

**Decision:** rewrite TileJSON in the proxy so the base map loads
**Why:** The proxy guarded the request URL but streamed the upstream response through untouched. Mapbox writes the account token into every entry of a TileJSON tiles array. The browser therefore received the pk.* token the proxy exists to keep out of it (ADR-0001). It is a public token, so the exposure is quota rather than account access, but the proxy's whole premise is that no credential reaches the client. The same URLs were the reason the base map never drew. Mapbox returns them as plaintext http on a/b.tiles.mapbox.com. An https page blocks those as mixed content, and transformRequest did not treat that host as Mapbox, so no base tile ever loaded and the map showed the route and chargers over an empty frame. Seven tests cover the leak, the http shards, the placeholders and the scrub. The suite goes from 49 to 56. Verified against a local production build with the real token: six vector tiles and three DEM tiles load through the proxy, base layers render, and no response body contains the token.
**Commit:** 8f227a0
**Source:** commit-capture

## 2026-09-06T21:13Z · davecthomas · fix/tilejson-token-leak

**Decision:** rewrite TileJSON in the proxy so the base map loads
**Why:** The proxy guarded the request URL but streamed the upstream response through untouched. Mapbox writes the account token into every entry of a TileJSON tiles array. The browser therefore received the pk.* token the proxy exists to keep out of it (ADR-0001). It is a public token, so the exposure is quota rather than account access, but the proxy's whole premise is that no credential reaches the client. The same URLs were the reason the base map never drew. Mapbox returns them as plaintext http on a/b.tiles.mapbox.com. An https page blocks those as mixed content, and transformRequest did not treat that host as Mapbox, so no base tile ever loaded and the map showed the route and chargers over an empty frame. Seven tests cover the leak, the http shards, the placeholders and the scrub. The suite goes from 49 to 56. Verified against a local production build with the real token: six vector tiles and three DEM tiles load through the proxy, base layers render, and no response body contains the token.
**Commit:** 64836f5
**Source:** commit-capture

