# Pythagoras — Requirements

## 1. Overview

A small, standalone, installable web app (Progressive Web App) that solves a **general
triangle**: given any 3 of its 6 values (3 sides, 3 angles), it computes the other 3. The
triangle diagram redraws to the actual solved shape and labels which side/angle is
which (`a`/`b`/`c`, `α`/`β`/`γ`); the 6 number fields — grouped "Sidor" (sides) and
"Vinklar" (angles) below the diagram — are where the real values are entered and shown.
All UI text is in Swedish. The app must work well on both Android (Chrome) and iPhone
(Safari), without requiring an app store.

## 2. Terminology / conventions

- Sides `a`, `b`, `c` and angles `α`, `β`, `γ`, with side `i` always opposite angle `i`.
- No vertex letters (A/B/C) are shown — only the side labels (`a`/`b`/`c`) and angle
  labels (`α`/`β`/`γ`), positioned on the diagram next to the part of the triangle they
  refer to, so the user can see which field maps to which edge/corner.

## 3. Functional requirements

### 3.1 Input
- 6 number fields below the diagram, in two side-by-side columns (fieldsets):
  - **Sidor** (left column): `a`, `b`, `c`, stacked vertically — plain lengths.
  - **Vinklar** (right column): `α`, `β`, `γ`, stacked vertically — degree values, each
    showing a `°` suffix inside the field, directly after the number.
- `γ` is pre-filled with **90** by default on load; the **"Töm"** button restores it to
  90 (rather than blanking it) while clearing the other 5 fields. Any field, including
  `γ`, can be edited or cleared freely like the others — this is just a convenient
  starting default, not a constraint.
- The user fills in any **3** of the 6 fields (any mix of sides/angles).
- Inputs recompute reactively as the user types, no explicit "Calculate" button.
- No routine "fill in N more values" hint text — the fields themselves (empty vs.
  filled) are the only indication of what's still needed. A status message only
  appears for actual problems (too many values, solve errors, ambiguous case).
- Once solved, the other fields are filled in directly: user-given fields are
  highlighted (accent-colored border + bold text), computed fields are distinguished
  by a dashed border only — both use the same high-contrast text color (no dimmed
  text), since legibility takes priority over the given/computed distinction.

### 3.2 Solving rules
A general triangle solver (law of sines / law of cosines) covering all standard cases:

| Case | Given | Result |
|---|---|---|
| SSS | 3 sides | Law of cosines → all 3 angles |
| SAS | 2 sides + included angle | Law of cosines → 3rd side, then law of sines |
| ASA / AAS | 2 angles + 1 side | 3rd angle = 180° − sum, then law of sines |
| SSA | 2 sides + non-included angle | **Ambiguous** — 0, 1, or 2 valid triangles |
| AAA | 3 angles, no side | **Insufficient** — shape only, not size |

The SSA ambiguous case is reachable here (unlike in the earlier right-triangle-only
design) and is surfaced via a "Lösning 1" / "Lösning 2" toggle above the status text;
choosing one redraws the diagram and refills the computed fields for that solution.

### 3.3 Triangle drawing
- Rendered as SVG, redrawn to the **actual solved triangle's proportions** every time
  (not a fixed shape) — scaled to fit a square container, dashed and dimmed while
  unsolved/invalid, solid once a valid solve completes.
- Labeled with `a`/`b`/`c` at side midpoints and `α`/`β`/`γ` at the vertices, each
  offset outward/away from the shape so labels never sit on top of an edge.
- Before 3 valid values are given, a default placeholder triangle (3-4-5, dashed) is
  shown.

### 3.4 Validation & error states
- Fewer than 3 values given → diagram falls back to the placeholder, no message.
- More than 3 values given → diagram falls back to the placeholder, with the message
  `"För många värden — töm ett fält."`.
- Triangle inequality violated, non-positive values, angle(s) out of range, angles
  summing incorrectly, no valid SSA solution → short Swedish error message.
- Three angles given without a side → message explaining shape-only-not-size
  (`"Tre vinklar ger bara formen, inte storleken..."`).
- SSA with 2 valid solutions → the solution-toggle UI (see 3.2), not an error.

### 3.5 Other controls
- A single **"Töm"** button clears all 6 inputs and returns to the placeholder state.

## 4. Non-functional / technical requirements

- **Language**: all visible UI text (labels, button, error messages, page title,
  manifest name) is in Swedish.
- **Delivery**: static PWA — HTML/CSS/JS, `manifest.json`, and a service worker.
  Installable via "Add to Home Screen" on both iOS Safari and Android Chrome.
- **Offline**: fully usable offline once installed (all computation is client-side).
- **No backend**: 100% client-side; no user data ever leaves the device.
- **No account / persistence**: no login or cloud storage.
- **Responsive / mobile-first**: the 6 fields are laid out in two columns (Sidor /
  Vinklar), each stacking its 3 fields vertically, so each field gets roughly half the
  screen width — enough room for a large, fixed font size (no shrinking needed).
  Verified down to 320px width with the longest realistic values (e.g. a 3-digit-degree
  angle with its `°`) without text clipping.
- **Theme**: permanently light — white field/card backgrounds with black input text,
  no automatic dark mode. This was a deliberate fix after real-device testing on
  Android showed the previous dark theme's dimmer text was hard to read.
- **Precision**: internal math in radians; UI displays lengths rounded to 2 decimal
  places, angles rounded to 1 decimal place.

## 5. Out of scope

- Unit conversion (a single generic length unit is assumed).
- Saving/history of multiple triangles.
- Accounts, cloud sync, or sharing features.
- Native app store distribution (PWA only).

## 6. History note

Earlier iterations of this app explored: inputs embedded directly on the triangle
diagram (no separate field list), a permanently-fixed right angle (only 2 of 5 values
needed), and a fixed non-rescaling 3-4-5 diagram. These were deliberately reverted back
to the general 6-field / 3-of-6 / dynamically-redrawn design described above, while
keeping improvements developed along the way: bigger fonts, higher-contrast field
styling, the in-box `°` suffix technique, and the Swedish minimal-error-text approach.
