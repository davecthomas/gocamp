# The Rockies Line

A camping route planner for an Austin → Seattle trip through the national and state
parks of the Rockies: Palo Duro Canyon, Golden Gate Canyon, Rocky Mountain, Bridger-Teton,
Grand Teton, Yellowstone, Farragut, and Glacier on an optional branch.

The page is a single self-contained `index.html`. No build step, no dependencies.

## What it does

- **Real map.** US state boundaries from public GeoJSON, projected with Albers equal-area
  conic, with the route plotted from actual latitude and longitude. Zoom, pan, fit-to-trip.
- **Detail on zoom.** Three tiers: parks and cities at rest, route towns and highway numbers
  past 1.7x, Supercharger names past 3.2x. Labels are placed in priority order and colliding
  ones are dropped, so dense areas like the Front Range stay readable.
- **Clickable stops.** Every pin opens elevation, leg distance and time, campground,
  dog rules, expected date, typical weather, and booking links.
- **Trip settings** that drive everything below them: charging cadence, nights per stop,
  average speed, load on board, the Glacier branch, and departure or arrival date.
- **EV range from a road-load model.** `F = Crr·m·g + ½·ρ·Cd·A·v²`, calibrated so Lucid's
  450-mile EPA figure is what the default load draws at 65 mph. Load and speed both move
  range, consumption, and every leg's climbing cost.
- **Weather** from 1991–2020 monthly climate normals for 13 stations, with lapse-rate
  corrections for Trail Ridge summit and Logan Pass.
- **Passes and fees** for all eight parks, with what the America the Beautiful pass covers.

## Editing

Edit `index.html` and push. Vercel redeploys on every push to `main`.

## Settings

| Setting | Default | What it moves |
|---|---|---|
| Miles between charging stops | 250 mi | Stop count, and the time shown between breaks |
| Nights per park or camp stop | 1 | Total days, and every stop's date |
| Average driving speed | 65 mph | Leg times, consumption, range, the schedule |
| Load on board | 620 lb | Consumption, range, every leg's climbing cost |
| Lowest allowable charge | 25% | Usable range, and it caps the charging interval |
| Glacier NP branch | off | Route, mileage, days, park count |
| Departure or arrival date | 19 Jun 2027 | Every stop's date and its expected weather |

## Charging

111 Tesla Supercharger sites within 12 miles of the route, from the supercharge.info
database, drawn on the map with a toggle to hide them. The longest gap between
consecutive sites on the default route is 249 miles, Rawlins WY to Jackson WY, and the
page warns when your reserve leaves less usable range than that gap needs.

## Mapbox token

The browser never receives a Mapbox credential.

`api/mapbox.js` is a Vercel Serverless Function that reads `MAPBOX_TOKEN` from the
project's environment variables, appends it to the upstream request server-side, and
streams the response back. Mapbox GL is configured with `transformRequest` so every
style, sprite, glyph, tile and terrain request is rewritten to that endpoint.

The proxy is narrow on purpose. An open proxy carrying your token is the same leak in
a different shape, so it rebuilds the upstream URL from an allow-listed host and path
prefix and forwards only a fixed set of query keys. The token is added by the function
and is never accepted from the caller.

It is a pass-through, not a cache: every request still reaches Mapbox and is still
billed to the token's account. Responses carry a long `s-maxage` so panning is served
by the CDN rather than becoming a function invocation per tile.

Set `MAPBOX_TOKEN` in the Vercel project's Environment Variables (Production and
Preview). Without it the function returns 503 and the page falls back to its built-in
schematic map, which needs no credentials at all.

## Layout

```
api/mapbox.js        serverless proxy, holds the token
public/index.html    page shell, no inline script or style
public/app.css       styles
public/app.js        application
public/data/*.js     climate normals, chargers, route geometry
vercel.json          output directory and headers
```

No build step. Vercel serves `public/` statically and `api/` as functions.

## Settings

| Setting | Default | What it moves |
|---|---|---|
| Miles between charging stops | 250 mi | Stop count, and the time shown between breaks |
| Nights per park or camp stop | 1 | Total days, and every stop's date |
| Average driving speed | 65 mph | Leg times, consumption, range, the schedule |
| Load on board | 620 lb | Consumption, range, every leg's climbing cost |
| Lowest allowable charge | 25% | Usable range, and it caps the charging interval |
| Glacier NP branch | off | Route, mileage, days, park count |
| Departure or arrival date | 19 Jun 2027 | Every stop's date and its expected weather |

## Charging

111 Tesla Supercharger sites within 12 miles of the route, from the supercharge.info
database, drawn on the map with a toggle to hide them. The longest gap between
consecutive sites on the default route is 249 miles, Rawlins WY to Jackson WY, and the
page warns when your reserve leaves less usable range than that gap needs.

## Mapbox token

The map uses Mapbox GL with a public `pk.*` token. The token is **not** committed:

1. Put it in a local `.env` as `MAPBOX_TOKEN=pk...` (gitignored, see `.env.example`)
2. Add the same `MAPBOX_TOKEN` to the Vercel project's Environment Variables
3. `build.sh` substitutes it into `public/index.html` at build time

A `pk.*` token ships inside the served page and anyone can read it there, so keeping
it out of git is about avoiding repo scraping and easy rotation, not secrecy. Restrict
it by URL in the Mapbox dashboard.

Without a token the page falls back to the built-in schematic SVG map, which needs no
network access at all.

