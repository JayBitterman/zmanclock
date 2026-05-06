# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Zman Clock is a static, browser-only single-page app that displays a 24-hour Hebrew zmanim clock with an animated sky/terrain scene reflecting real sun position, weather, and season. There is **no build step, no package.json, and no test framework** — `index.html` loads `js/main.js` as an ES module, and all third-party libraries are imported directly from CDNs (esm.sh / jsdelivr / unpkg) at runtime.

## Running locally

Because `js/main.js` uses ES module imports, opening `index.html` via `file://` will not work — modules must be served over HTTP(S). Geolocation also requires a secure context (HTTPS or `localhost`). Any static server works:

```
python -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000`. There are no lint, test, or build commands.

## Architecture

### Module graph (`js/`)

`main.js` is the entry point and orchestrator. Other modules are roughly layered:

- [js/config.js](js/config.js) — single mutable `state` object (location, date, sun times, navigation offsets, observer) plus Hebrew label constants. Every other module imports `state` directly; this is the canonical place to read/mutate runtime values.
- [js/astronomy.js](js/astronomy.js) — wraps `astronomy-engine` to compute sunrise/sunset, alos (-16.1°), misheyakir (-10.2°), tzeis (-8.5°), MGA hours, chatzos, plag, R' Tam, etc. Writes results into `state.sunTimes`. Throws an `Error` with `isPolarLocation = true` if the sun does not rise/set on the requested day — callers must handle this.
- [js/hebrew.js](js/hebrew.js) — Hebrew date / parsha / holidays / Omer via `@hebcal/core` and `jewish-date`. Critical: Hebrew date rollover is at **tzeis**, not local midnight, and is computed in the *target* timezone (see `updateHebrewDate`).
- [js/clock.js](js/clock.js) — positions the 24 Hebrew hour labels, sun/moon, and the single hand around the analog face.
- [js/scene.js](js/scene.js) — terrain SVG, vegetation, stars, birds, and weather effects (clouds, rain, snow, fog, lightning). Owns DOM-element pools with hard caps (`MAX_CLOUDS = 80`) and a periodic cleanup interval to prevent leaks during fast-forward / rapid day navigation.
- [js/weather.js](js/weather.js) — Open-Meteo (no API key) fetch + WMO code mapping into `weatherState`.
- [js/location.js](js/location.js) — Leaflet map picker, zip / city search via Nominatim. Lazy-loads Leaflet JS/CSS on first open. Custom locations dispatch a `locationChanged` CustomEvent.
- [js/calendar.js](js/calendar.js) — Hebrew/Gregorian calendar popup. Selecting a date dispatches `calendarDateSelected`.
- [js/ui.js](js/ui.js) — digital time displays, Hebrew date string, atmosphere/sky color (sun-elevation-based color lerp).

Cross-module communication outside of imports happens via **window CustomEvents**: `locationChanged`, `locationReverted`, `calendarDateSelected`. `main.js` listens for these.

### The main loop (`main.js` → `updateClock`)

`updateClock` runs at ~50fps (50 ms interval). Each tick:

1. Compute "displayed time" = `Date.now() + state.offset + state.daysAhead * 86_400_000`. `offset` is the speed-multiplier accumulator; `daysAhead` is the day-navigation offset.
2. `calcSunTimes` — recomputes all zmanim for the displayed date. May throw a polar-location error.
3. **Per-frame (cheap):** clock hand, digital times, sky atmosphere, scene visuals, moon position.
4. **Throttled to ~10fps (`lastSlowUpdate` gate):** Hebrew date, special-day status (minor fasts, erev pesach → biur chametz), zman labels around the clock face.

Two separate intervals exist: `state.intervalId` advances `state.offset` when speed-multiplier is non-zero (the "fast forward" feature), and `state.clockIntervalId` is the 50 ms render loop. Don't conflate them.

### Polar locations

If the user's location (or a custom-picked one) doesn't have sunrise/sunset on the displayed day, `calcSunTimes` throws `{ isPolarLocation: true }`. `main.js` catches this, sets `window._polarLocationActive = true`, stops the clock interval, and shows a "Consult a Rov" popup. The flag is only cleared when a valid location is set via `locationChanged`. When editing astronomy or location code, preserve this flow — silently swallowing the error will produce wrong zmanim.

### Timezones

When a custom location is picked, `state.timezone` is set to an IANA string (e.g. `"Asia/Jerusalem"`). All date-rollover logic (Hebrew date, "today" for sun calculations) must use this timezone, not the browser's local timezone — see how `astronomy.js` and `hebrew.js` use `Intl.DateTimeFormat` with `timeZone: tz` to extract Y/M/D parts. Don't use `state.date.getDate()` etc. directly for day-boundary decisions; that reads local-browser time and breaks for users viewing zmanim in another zone.

### Rapid-navigation memory hazard

Day buttons and calendar date selection are debounced (80 ms / 100 ms) and call `cancelPendingCloudSpawns()` on each click before scheduling the heavy recompute. This was added to stop cloud DOM elements from accumulating when the user mashes the day-forward button. If you add new navigation entry points, follow the same pattern.

### External dependencies (loaded at runtime, not bundled)

- `astronomy-engine@2.1.19`, `@hebcal/core@5.5.0`, `jewish-date@2.0.12`, `@turf/turf@7.1.0` — esm.sh / jsdelivr
- `leaflet@1.9.4` — unpkg, lazy-loaded by `location.js`
- Open-Meteo (weather), Nominatim (geocoding) — no key, public endpoints
- `il.json` — GeoJSON polygon of Israel, used by `inIsrael(lat, lon)` to switch between Eretz Yisrael and Chutz La'aretz holiday/parsha logic

## Conventions

- Files are lowercase (see commit `ca1f554` — case sensitivity matters because some users serve via case-sensitive hosts). Keep new module filenames lowercase.
- Don't introduce a bundler or `package.json` unless explicitly asked — the no-build, CDN-import design is intentional.
- Hebrew strings are written directly in source as RTL UTF-8; don't escape them.
