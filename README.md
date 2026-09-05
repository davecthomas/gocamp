# The Rockies Line

A camping route planner for an Austin → Seattle trip through the national and state
parks of the Rockies: Palo Duro Canyon, Golden Gate Canyon, Rocky Mountain, Bridger-Teton,
Grand Teton, Yellowstone, Farragut, and Glacier on an optional branch.

The page is a single self-contained `index.html`. No build step, no dependencies.

## What it does

- **Real map.** US state boundaries from public GeoJSON, projected with Albers equal-area
  conic, with the route plotted from actual latitude and longitude. Zoom, pan, fit-to-trip.
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
