#!/usr/bin/env bash
set -euo pipefail

# The rockies-line Vercel project is configured with:
#   Build Command:     bash build.sh
#   Output Directory:  public
# The site is a single static file, so the build just stages it.
mkdir -p public
cp index.html public/index.html
echo "staged public/index.html ($(wc -c < public/index.html | tr -d ' ') bytes)"
