---
id: "ADR-0005"
title: "The charge-reserve check is grounded in real charger positions, not the abstract interval"
status: "accepted"
date: "2026-09-06"
tags: "scenarios,lib"
must_read: false
supersedes: ""
superseded_by: ""
---

# ADR-0005: The charge-reserve check is grounded in real charger positions, not the abstract interval

## Context

A reserve setting that only shrinks a nominal charging interval tells a driver nothing about whether a specific stretch of the route is survivable. On this route the binding constraint is a 249 mile run between Rawlins and Jackson with no Supercharger on it, and only two of the 111 sites near the route are in Wyoming.

## Decision

Charger positions come from the supercharge.info database, filtered to sites within twelve miles of the route, and the distances between consecutive sites along the route are measured and stored with the scenario. The reserve setting caps the planned charging interval at the range available above the reserve, and the page separately checks that measured gap list, naming the first stretch that will not fit.

## Alternatives

Warn only when the nominal interval exceeds usable range, rejected because it can pass while a real gap on the route cannot be driven. Fetch charger data live, rejected because no public source exposes real-time stall availability: Tesla's endpoint refuses unauthenticated requests, supercharge.info carries no occupancy field, and Open Charge Map requires a key and still lacks live status.

## Consequences

Charger positions and gaps are scenario data and go stale; refresh them from supercharge.info when a scenario is revised. Do not present stall availability or busyness as live, because no public source provides it. A new scenario needs its own filtered charger list and measured gaps.

## Sources

- 352c4f0
