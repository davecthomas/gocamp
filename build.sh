#!/usr/bin/env bash
set -euo pipefail

# Stages the site into public/ and injects the Mapbox token.
#
# The token is never committed. It comes from the MAPBOX_TOKEN environment
# variable, which Vercel supplies from the project's Environment Variables and
# a local .env supplies when building by hand.
#
# A Mapbox pk.* token is a public token: it ships inside the served page and
# anyone can read it there. Keeping it out of git avoids repo scraping and makes
# rotation a config change rather than a commit, but the real control is a URL
# restriction on the token in the Mapbox dashboard.

if [ -z "${MAPBOX_TOKEN:-}" ] && [ -f .env ]; then
  set -a; . ./.env; set +a
fi

mkdir -p public
cp index.html public/index.html

if [ -n "${MAPBOX_TOKEN:-}" ]; then
  python3 - "$MAPBOX_TOKEN" <<'PY'
import sys, pathlib
tok = sys.argv[1]
p = pathlib.Path('public/index.html')
s = p.read_text(encoding='utf-8')
n = s.count('__MAPBOX_TOKEN__')
p.write_text(s.replace('__MAPBOX_TOKEN__', tok), encoding='utf-8')
print(f'injected Mapbox token into {n} placeholder(s)')
PY
else
  echo "warning: MAPBOX_TOKEN not set, the page will fall back to the schematic map"
fi

echo "staged public/index.html ($(wc -c < public/index.html | tr -d ' ') bytes)"
