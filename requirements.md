# Triangle Solver PWA — Requirements

## 1. Overview

A small, standalone, installable web app (Progressive Web App) that lets a user solve a
triangle: given any 3 known values out of a triangle's 3 sides and 3 angles, the app
computes the remaining 3 values and draws the triangle to scale. The drawing updates
live as the user edits inputs. The app must work well on both Android (Chrome) and
iPhone (Safari), without requiring an app store.

## 2. Terminology / conventions

- Vertices: **A**, **B**, **C**
- Sides: **a**, **b**, **c** — each side is opposite the vertex/angle with the same letter
  (side `a` is opposite angle `α` at vertex A, etc.)
- Angles: **α, β, γ** (at vertices A, B, C respectively), measured in degrees in the UI
- This labeling is used consistently across inputs, the drawing, and this document so
  there's no ambiguity about which side pairs with which angle.

## 3. Functional requirements

### 3.1 Input
- Six input fields, one each for `a`, `b`, `c`, `α`, `β`, `γ`. Any field may be empty.
- The user is expected to fill in exactly **3** of the 6 fields (any mix of sides and/or
  angles).
- Inputs recompute reactively as the user types (debounced), without requiring an
  explicit "Calculate" button.

### 3.2 Solving rules
The app must correctly solve all standard triangle cases:

| Case | Given | Method |
|---|---|---|
| SSS | 3 sides | Law of cosines → all 3 angles |
| SAS | 2 sides + included angle | Law of cosines → 3rd side, then law of sines → remaining angles |
| ASA / AAS | 2 angles + 1 side | 3rd angle = 180° − sum of the other two, then law of sines → remaining sides |
| SSA | 2 sides + a non-included angle | **Ambiguous case** — may yield 0, 1, or 2 valid triangles; the app must detect this and surface it to the user (see 3.4) |
| AAA | 3 angles, no side | **Insufficient information** — shape is determined but size is not. Treated as invalid input (see 3.4), since the app's contract is to compute a unique, fully-determined triangle. |

### 3.3 Triangle drawing
- Rendered on canvas or SVG, scaled to fit the viewport.
- Updates automatically whenever a valid solve completes.
- Vertices, sides, and angles are labeled on the drawing.
- Before 3 valid values are entered, a sensible default/placeholder triangle is shown.

### 3.4 Validation & error states
The app must detect and clearly message the following invalid states rather than
showing a broken or silently-wrong triangle:
- Fewer or more than 3 values provided (prompt the user to enter exactly 3).
- Triangle inequality violated (for SSS/SAS-derived side combinations).
- Given angles sum to ≥ 180° (or ≤ 0°).
- Non-positive side lengths or angles.
- SSA case with 0 valid solutions (no triangle exists).
- SSA case with 2 valid solutions (ambiguous case) — both solutions are surfaced to the
  user (e.g. shown side-by-side or via a toggle), rather than silently picking one.
- AAA-only input (3 angles, no side) — flagged as insufficient to determine a unique
  triangle.

### 3.5 Other controls
- A reset/clear control to blank all inputs and return to the placeholder triangle.

## 4. Non-functional / technical requirements

- **Delivery**: static PWA — HTML/CSS/JS, `manifest.json`, and a service worker.
  Installable via "Add to Home Screen" on both iOS Safari and Android Chrome.
- **Offline**: fully usable offline once installed (no network calls required at all,
  since all computation is client-side).
- **No backend**: 100% client-side; no user data ever leaves the device.
- **No account / persistence**: no login or cloud storage.
  - Optional stretch goal: remember the last input values via `localStorage` so the app
    reopens where the user left off. Not required for v1.
- **Responsive / mobile-first**: layout works on small phone screens in portrait
  orientation primarily; touch-friendly input fields with numeric keyboards.
- **Precision**: internal math performed in radians; UI displays degrees, rounded to a
  reasonable precision (e.g. 2 decimal places) for both angles and lengths.

## 5. Out of scope

- Unit conversion (a single generic length unit is assumed; no cm/inch/etc. switching).
- Saving/history of multiple triangles.
- Accounts, cloud sync, or sharing features.
- Native app store distribution (PWA only for v1).
