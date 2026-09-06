---
id: "ADR-0004"
title: "Range comes from a road-load model calibrated to the published EPA figure"
status: "accepted"
date: "2026-09-06"
tags: "lib"
must_read: false
supersedes: ""
superseded_by: ""
---

# ADR-0004: Range comes from a road-load model calibrated to the published EPA figure

## Context

A trip planner for a mountain route needs range to respond to what the driver actually changes: how much they are carrying and how fast they drive. A fixed Wh/mi constant cannot do that, and a first-principles model alone would not reproduce the manufacturer's published range.

## Decision

Consumption is computed from the road-load equation, rolling resistance plus aerodynamic drag, and then scaled so the published EPA range is exactly what the default load draws at the scenario's baseline speed. Rolling resistance carries the load term and drag carries the speed-squared term. Elevation is a separate term: lifting the loaded car costs energy at drivetrain efficiency, descending returns a fraction of it at a regen recovery rate, and both are expressed in miles at whatever the car is drawing per mile at the time.

## Alternatives

A fixed Wh/mi constant, rejected because load and speed then change nothing. A pure first-principles model with no calibration, rejected because it would not match the published range and the numbers would look wrong next to the manufacturer's figure.

## Consequences

Vehicle coefficients (drag, frontal area, rolling resistance, efficiencies) are scenario data, so a different vehicle is a YAML change. The calibration is a stated assumption, not a measurement: it treats the EPA figure as the default load at baseline speed. A test asserts the model reproduces the EPA range exactly at that reference point; keep it passing when the model changes.

## Sources

- ee4414c
- README.md § What it does
