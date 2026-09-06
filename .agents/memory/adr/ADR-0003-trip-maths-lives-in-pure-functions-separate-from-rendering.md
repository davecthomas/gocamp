---
id: "ADR-0003"
title: "Trip maths lives in pure functions, separate from rendering"
status: "accepted"
date: "2026-09-06"
tags: "lib,tests"
must_read: true
supersedes: ""
superseded_by: ""
---

# ADR-0003: Trip maths lives in pure functions, separate from rendering

## Context

The original implementation computed range, schedule and weather inline while building HTML strings, poking about fifteen DOM nodes by id from a single recompute function. Nothing could be tested without a browser, and several bugs were shape errors that surfaced only at runtime.

## Decision

lib/trip.ts and lib/weather.ts hold the maths as pure functions that take a scenario plus settings and return numbers, with no DOM or framework coupling. Rendering consumes those results. tests/trip.test.ts exercises them directly.

## Alternatives

Leave the maths inside components and test through the rendered UI, rejected because it makes the arithmetic that matters here, energy and scheduling, the hardest part to verify.

## Consequences

New calculations go in lib/ as pure functions with tests, not inside a component. A change to the energy or scheduling model should show up as a failing test before it shows up in the UI. Run npm test and npm run typecheck before pushing.

## Sources

- 06c9330
