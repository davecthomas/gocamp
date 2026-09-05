#!/usr/bin/env bash
set -euo pipefail

# Stages the site into public/.
#
# The Mapbox token is deliberately NOT injected into the page. A token baked into
# static HTML is readable by anyone who views source, so storing it in an
# environment variable keeps it out of git but does nothing to keep it out of the
# served page. Until a URL-restricted token or a server-side proxy is in place,
# the page falls back to its built-in schematic map, which needs no credentials.

mkdir -p public
cp index.html public/index.html

if grep -q '__MAPBOX_TOKEN__' public/index.html; then
  echo "no token injected: the page will use its built-in schematic map"
fi

echo "staged public/index.html ($(wc -c < public/index.html | tr -d ' ') bytes)"
