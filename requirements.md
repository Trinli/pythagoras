# Triangle Solver PWA — Requirements

## 1. Overview

A small, standalone, installable web app (Progressive Web App) that solves a **right
triangle**: the right angle is always fixed at 90°, so the user only ever needs to
provide 2 of the remaining 5 values (2 legs, the hypotenuse, and 2 acute angles). The
app computes the rest and fills the numbers into the diagram as the user types. The
diagram itself is a fixed, classic 3-4-5 right triangle (right angle at bottom-right)
that never changes shape — only the 5 input values change. The UI is deliberately
minimal — inputs live directly on the triangle diagram, with (almost) no surrounding
label text. All UI text is in Swedish. The app must work well on both Android (Chrome)
and iPhone (Safari), without requiring an app store.

## 2. Terminology / conventions

- Internally: sides `a`, `b`, `c` and angles `α`, `β`, `γ`, with side `i` always opposite
  angle `i` (same convention as a general triangle solver).
- `γ` (gamma) is **permanently fixed at 90°** — it is not a user-editable value. Side `c`
  is therefore always the hypotenuse; `a` and `b` are the two legs ("kateter"); `α` and
  `β` are the two acute angles (summing to 90°).
- None of this internal `a/b/c/α/β/γ` naming is shown to the user — fields are
  identified purely by their position on the drawing (on a leg, on the hypotenuse, or
  next to an acute-angle vertex).

## 3. Functional requirements

### 3.1 Input
- 5 number inputs, positioned directly on the triangle visualization:
  - One at the midpoint of each side (2 legs + hypotenuse) — plain length, no unit label.
  - One near each of the 2 acute-angle vertices — plain angle value, no unit label.
- The right-angle vertex has no input; it's marked only with a small square (the
  standard right-angle mark), never a number — the value is always implicitly 90°.
- The user fills in any **2** of the 5 fields (any mix of sides/angles); the right angle
  supplies the implicit 3rd known value the solver needs.
- Inputs recompute reactively as the user types, no explicit "Calculate" button.
- Once solved, the 3 remaining fields are filled in directly (not shown separately):
  user-given fields are visually distinguished (highlighted) from computed fields
  (dimmed/italic).

### 3.2 Solving rules
Reuses a general triangle solver (law of sines / law of cosines), with `γ` always passed
in as 90°. Enumerating all `C(5,2) = 10` possible pairs of given values shows this always
resolves to a unique triangle or a clear error — the classic SSA *ambiguous* 2-solution
case cannot occur here, because:
- 2 legs + the (always-known) right angle is always **SAS** (right angle is the included
  angle between the legs) → unique.
- A leg + the hypotenuse is the leg/hypotenuse congruence case → unique (the generic
  ambiguous-case math naturally collapses to 1 valid solution here).
- A side + an acute angle is **AAS/ASA** (right angle + given angle + given side) →
  unique.
- Both acute angles given (no side) → shape only, not size (see 3.4) — expected, since
  `β = 90° − α` always, so this is redundant information.

The solver's ambiguous-case branch is kept for robustness (defensive fallback: silently
uses the first solution) but is not expected to be reachable through the UI.

### 3.3 Triangle drawing
- Rendered as SVG, a **fixed, unchanging** classic 3-4-5 right triangle with the right
  angle at bottom-right. The shape/proportions never change as the user types — only
  the 5 overlay input values do. This is intentional: a triangle that visibly rescaled
  with every keystroke was found to be more distracting than useful.
- The drawing's only dynamic feedback is a solid-vs-dashed outline: dashed while
  unsolved/invalid, solid once a valid solve completes.
- No vertex letters, no text labels on sides/angles — the 5 input fields *are* the
  labels, positioned at the same spots a text label would occupy (side midpoints,
  outward from the two acute vertices), so numbers never sit on top of triangle edges.
  Input positions are computed once (they never need to move, since the shape is fixed).

### 3.4 Validation & error states
- Fewer than 2 or more than 2 values given → the diagram + inputs remain, with a short
  Swedish message only in the "too many" case (`"För många värden — töm ett fält."`);
  no message when simply waiting for more input (self-explanatory from empty fields).
- Triangle inequality violated, non-positive values, angle(s) out of range, or angles
  summing incorrectly → short Swedish error message, computed fields cleared.
- Both acute angles given without a side → Swedish message explaining shape-only-not-size.
- No success message on a valid solve — the filled-in numbers and updated drawing are
  the only feedback (minimal-text philosophy).

### 3.5 Other controls
- A single button, labeled **"Töm"**, clears all 5 inputs and returns to the placeholder
  triangle. This is the only persistent UI text besides error messages.

## 4. Non-functional / technical requirements

- **Language**: all visible UI text (button, error messages, page title, manifest name)
  is in Swedish.
- **Delivery**: static PWA — HTML/CSS/JS, `manifest.json`, and a service worker.
  Installable via "Add to Home Screen" on both iOS Safari and Android Chrome.
- **Offline**: fully usable offline once installed (no network calls required at all,
  since all computation is client-side).
- **No backend**: 100% client-side; no user data ever leaves the device.
- **No account / persistence**: no login or cloud storage.
- **Responsive / mobile-first**: layout works on small phone screens in portrait
  orientation; touch-friendly inputs with numeric keyboards; input positions use
  fixed percentage-based placement over the (unchanging) diagram, so they line up
  correctly regardless of screen size.
- **Precision**: internal math in radians; UI displays degrees/lengths rounded to 2
  decimal places.

## 5. Out of scope

- Non-right triangles (general 3-of-6 triangle solving was the v1 design; this version
  deliberately narrows to right triangles only, per simplification request).
- Unit conversion (a single generic length unit is assumed).
- Saving/history of multiple triangles.
- Accounts, cloud sync, or sharing features.
- Native app store distribution (PWA only).
