# Decision notes 2026-09-07

## 2026-09-07T17:11Z · davecthomas · main

**Decision:** Leave the Wyoming charger list alone: it is complete, and the gap it shows is real.
**Why:** The route looks under-served across Wyoming, and the obvious reading is that the charger list is missing entries. Checked against supercharge.info's allSites feed, which is Tesla Superchargers only and is the source the existing names already match (all 111 matched exactly). Wyoming has 13 open Superchargers. Only Rawlins (1 mi off route) and Jackson (2 mi) are anywhere near this line; the next nearest is Laramie at 50 mi, then Rock Springs at 82 mi. The reason is the routing: the line does not take I-80 across the state. It runs Rawlins north on US-287 through Lander and Dubois to Moran Junction and Jackson, a corridor with no Superchargers at all. Geometry confirms it at 42.833/-108.731, 43.533/-109.630 and 43.842/-110.515. So the 249.2 mi Rawlins-to-Jackson entry in chargerGaps is a true property of the route, and it is already the worst gap the reserve check reports.
**Alternatives:** Refreshing the whole list from the live feed was measured and rejected as a no-op: seven Superchargers have opened since the list was built, all 12 to 14 miles off route near Denver, Seattle and Austin where coverage is already dense. The worst gap is identical at 249.2 mi and the second improves by 3.4 mi. A recomputation method was validated against the recorded gaps first and reproduced them to within 0.4 mi, so the comparison is trustworthy.
**Scope:** scenarios/rockies-line.yaml

## 2026-09-07T17:24Z · davecthomas · fix/charger-click-blocked

**Decision:** stop the hover panel swallowing the click on a charger
**Why:** A charger could not be clicked because its own hover panel was in the way. Mapbox sets .mapboxgl-popup-content to pointer-events:auto. The hover panel opens on mouseenter at an offset of 10px from the point, so its content box sits directly over the icon it describes. Pressing the mouse hit the panel, the canvas never saw the event, and the map never fired a click. Enlarging the icons to 22px made it worse, since more of the icon reached into the panel. The hover panel now carries a class that turns pointer events off, so it can be looked at and never aimed at. The panel a click pins open keeps them, since its links have to stay clickable. Both sit 16px off the point, clear of the icon. This is also why the stop pins worked while chargers did not. A stop is a DOM marker with no hover panel over it. Four booking links on one nowrap line also ran past the panel and across the open map. The row wraps now, and each link still keeps its own words together.
**Commit:** 771db51
**Source:** commit-capture

## 2026-09-07T17:38Z · davecthomas · feat/charger-popup-links

**Decision:** give the charger panel somewhere to go
**Why:** A charger panel said a name, a stall count and a power figure, and offered nothing to do. Every stop panel beside it carries booking and trail links, so the charger read as the one dead end on the map. It now links to Tesla's own page for the site, which carries the address, access hours, amenities and pricing, and to driving directions for its coordinates. The link needs Tesla's id for the site, so each charger carries one, taken from the same supercharge.info feed the names already came from. I opened all three id shapes in a browser first: the slug form, the mixed case form and the bare numeric form all resolve. Hours, amenities and the address itself drift, so the panel links to Tesla's page and copies none of it. The hover panel stays text only. Its content ignores pointer events so that it cannot swallow the click underneath it, so links there could not be followed. One entry was not a Tesla Supercharger at all. The upstream feed marks another network with a bracketed prefix, and [HiON EV] Greenwood Village sat in the list. It is gone, and a test refuses the shape. Removing it leaves every recorded gap unchanged, which the recomputation confirms. Quoting matters in the data: YAML reads a bare 19096 as a number, which made locationId a number for half the chargers while the type promised a string. The test caught it. Every id is quoted.
**Commit:** 8a598ff
**Source:** commit-capture

