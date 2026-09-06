---
id: "ADR-0001"
title: "No Mapbox credential reaches the browser; a server-side proxy holds the token"
status: "accepted"
date: "2026-09-06"
tags: "api,lib,security"
must_read: true
supersedes: ""
superseded_by: ""
---

# ADR-0001: No Mapbox credential reaches the browser; a server-side proxy holds the token

## Context

The map first shipped with a Mapbox public token substituted into the HTML at build time from a gitignored .env. That kept the token out of the repository but left it readable by anyone viewing page source, which is a leak regardless of where it is stored. The token in use had to be rotated. A pk token is designed to be embedded and URL-restricted, but the requirement here was that no credential be present in the client at all.

## Decision

api/mapbox.js is a serverless function that reads MAPBOX_TOKEN from the deployment environment, appends it to the upstream request, and streams the response back. Mapbox GL is configured with transformRequest so every style, sprite, glyph, tile and terrain request is rewritten to that endpoint. The proxy rebuilds the upstream URL from an allow-listed host and path prefix and forwards only a fixed set of query keys, so it cannot be used as an open proxy carrying the account token, and it never accepts a token from a caller.

## Alternatives

Embed a URL-restricted pk token, which is what Mapbox designs for and needs no infrastructure, rejected because the token would still be readable in page source. Keep injecting at build time from an environment variable, rejected because storing a secret outside git does nothing to keep it out of the served page.

## Consequences

Never put a Mapbox token in client code, a data file, or the HTML. New map features route their requests through the proxy and may need a path prefix added to its allow list. The proxy is a pass-through, not a cache, so requests still bill the token owner; responses carry a long s-maxage so panning is served by the CDN rather than one function invocation per tile.

## Sources

- a34c7c8
- 4b3c869
