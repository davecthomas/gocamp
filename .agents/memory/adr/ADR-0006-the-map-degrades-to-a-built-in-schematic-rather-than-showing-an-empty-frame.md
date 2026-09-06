---
id: "ADR-0006"
title: "The map degrades to a built-in schematic rather than showing an empty frame"
status: "accepted"
date: "2026-09-06"
tags: "app,components"
must_read: false
supersedes: ""
superseded_by: ""
---

# ADR-0006: The map degrades to a built-in schematic rather than showing an empty frame

## Context

The real map depends on things that can be absent: a configured token, a reachable tile host, WebGL, and a tab that actually paints. Each failure would otherwise leave a blank grey box where the map should be.

## Decision

The page ships a self-contained schematic map drawn from projected state boundaries and route geometry, needing no network access or credentials. The real map replaces it only once it has genuinely loaded. If the token is missing or rejected, or the map has not finished within a timeout, the page reverts to the schematic.

## Alternatives

Show the real map unconditionally and accept a blank frame when it fails, rejected because the failure is silent and looks like a broken page. Show only the schematic, rejected because it lacks the roads, terrain and place names the route needs.

## Consequences

Keep the schematic renderer working; it is the fallback, not dead code. Any change to map initialisation must preserve the load guard and the revert path. A deployment without MAPBOX_TOKEN is a supported state that must still render a usable page.

## Sources

- a34c7c8
- d7bd189
