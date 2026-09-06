# GoCamp

Camping route planner. Each route is a **scenario**: a YAML file describing the legs,
the parks, the vehicle, the charging network and the prose. The app renders whichever
scenario you pick and works out the driving, charging, weather and paperwork for it.

The Rockies Line, an Austin-to-Seattle route through the national and state parks of
the Rockies, is the first scenario. It lives at `scenarios/rockies-line.yaml`, not in
the app's name, so a second route is a new file rather than a rename.

Live at https://gocamp-us.vercel.app

## Adding a scenario

Add a YAML file under `scenarios/`. No code changes. It appears on the index and gets
its own page at `/s/<slug>`, prerendered at build time.

`lib/scenarios.ts` validates the file at build, so a missing or malformed field fails
the build with the field named rather than shipping a broken page. The shape lives in
`lib/types.ts`.

## Layout

```
app/
  page.tsx              scenario index
  s/[slug]/page.tsx     one scenario, prerendered per slug
  api/mapbox/route.ts   Mapbox proxy, holds the token server-side
  globals.css
components/             view layer; useTrip.ts holds the settings state
lib/
  trip.ts               range, energy, schedule — pure, tested
  weather.ts            climate normals with lapse-rate correction
  mapbox-proxy.ts       upstream URL policy, tested
  scenarios.ts          YAML loader and validator
  data/climate.ts       shared station normals
scenarios/*.yaml        the routes
tests/                  48 tests
```

## Development

```
npm install
npm run dev        # http://localhost:3000
npm test           # 48 tests
npm run typecheck
npm run build
```

## Mapbox token

The browser never receives a Mapbox credential (ADR-0001).

`app/api/mapbox/route.ts` reads `MAPBOX_TOKEN` from the environment, appends it to the
upstream request server-side, and streams the response back. Mapbox GL uses
`transformRequest` so every style, sprite, glyph, tile and terrain request is rewritten
to that endpoint.

The proxy is narrow on purpose: it rebuilds the upstream URL from an allow-listed host
and path prefix, forwards only a fixed set of query keys, and never accepts a token from
a caller. `tests/mapbox-proxy.test.ts` asserts those properties.

It is a pass-through, not a cache, so requests still bill the token's account. Responses
carry a long `s-maxage` so panning is served by the CDN rather than one function
invocation per tile.

Set `MAPBOX_TOKEN` in Vercel under **Environment Variables** (Production and Preview),
and locally in a gitignored `.env`. Without it the route returns 503 and the map is
hidden rather than showing an empty frame (ADR-0006).

## Decisions

`.agents/memory/adr/` records the decisions that still govern this code. Read the ones
marked must-read before making architectural changes.

## Naming

The app is called GoCamp, at `gocamp-us.vercel.app`. Plain `gocamp` and `go-camp` were
both already taken on Vercel's shared `.vercel.app` namespace by an unrelated camping
gear company, so this project carries the `-us` suffix. The GitHub repo lives at
`github.com/davecthomas/gocamp`.

`rockies-line.vercel.app` was the project's original URL, from when this was a
single-scenario app named after its one route. It's superseded by `gocamp-us.vercel.app`
above and no longer maintained; delete the `rockies-line` and `rockies-line-site`
Vercel projects once you've moved `MAPBOX_TOKEN` and any custom domain over.
