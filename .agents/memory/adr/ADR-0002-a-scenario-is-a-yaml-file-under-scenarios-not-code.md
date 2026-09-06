---
id: "ADR-0002"
title: "A scenario is a YAML file under scenarios/, not code"
status: "accepted"
date: "2026-09-06"
tags: "scenarios,lib"
must_read: true
supersedes: ""
superseded_by: ""
---

# ADR-0002: A scenario is a YAML file under scenarios/, not code

## Context

The planner began as one route hard-coded as JavaScript objects inside a single file. More scenarios were planned, and adding a second route would have meant editing application code and duplicating render logic. The route content is data: legs, elevations, geometry, chargers, vehicle assumptions and the prose that describes them.

## Decision

Each scenario is one YAML file under scenarios/. It carries every leg, the vehicle assumptions and defaults, map geometry, charger positions and measured gaps, road seasons, and the page prose (callouts, checklist, fee table, seasonal windows). lib/scenarios.ts reads and validates it at build time, failing the build with the offending field named rather than rendering a broken page. Shared reference data that is not route-specific, such as the climate normals, stays in lib/data and is referenced by station key.

## Alternatives

Keep scenarios as typed TypeScript modules, which would give compile-time checking without a validator but keeps content in code and needs a developer to add a route. A database or CMS, rejected as far too much machinery for a handful of files that version well in git.

## Consequences

Adding a scenario means adding a YAML file, not writing code. Changing the scenario shape means updating lib/types.ts and the validator in lib/scenarios.ts together, and every existing YAML file must satisfy the new shape or the build fails. Do not put route content back into components.

## Sources

- 06c9330
