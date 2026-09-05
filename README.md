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

## Deploying

`index.html` is the whole site. Two Vercel projects build from this repo:

- **rockies-line** runs `bash build.sh`, which stages `index.html` into `public/`.
  That build command was set when the project was first created by file upload,
  and `build.sh` exists to satisfy it.
- **rockies-line-site** builds the repo root directly with no build step.

GitHub Pages also serves `main` at https://davecthomas.github.io/rockies-line/
