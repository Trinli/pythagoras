'use strict';

/*
 * Indexing convention: index 0/1/2 = a/b/c and alpha/beta/gamma.
 * Side i is always opposite angle i. Gamma (index 2) is permanently 90°:
 * this app only solves right triangles, so the app only ever asks for 2
 * of the remaining 5 values (a, b, c, alpha, beta) — gamma is the 3rd,
 * implicit, always-known value the solver needs.
 *
 * The diagram itself never changes shape — it's always the same fixed
 * 3-4-5 right triangle with the right angle at bottom-right. Only the
 * numbers shown in the 5 overlay inputs change as the user types.
 */

const ANGLE_EPS = 1e-6; // degrees
const RATIO_EPS = 1e-9;
const RIGHT_ANGLE = 90;

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function fmt(n) { return Math.round(n * 100) / 100; }

function lawOfCosinesAngles(sides) {
  const [a, b, c] = sides;
  const A = toDeg(Math.acos(clamp((b * b + c * c - a * a) / (2 * b * c), -1, 1)));
  const B = toDeg(Math.acos(clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1)));
  const C = 180 - A - B;
  return [A, B, C];
}

/**
 * Solve a triangle given partial sides/angles arrays (null = unknown).
 * Returns one of:
 *   { status: 'incomplete' }                                fewer/more than 3 known
 *   { status: 'insufficient', message }                      angles only, no size
 *   { status: 'error', message }                              invalid combination
 *   { status: 'ok', sides, angles }                           unique solution
 *   { status: 'ambiguous', solutions: [{sides,angles}, ...] }  SSA with 2 solutions
 */
function solveTriangle(sidesIn, anglesIn) {
  const sides = sidesIn.slice();
  const angles = anglesIn.slice();
  const knownSideIdx = [0, 1, 2].filter((i) => sides[i] != null);
  const knownAngleIdx = [0, 1, 2].filter((i) => angles[i] != null);

  for (const i of knownSideIdx) {
    if (!(sides[i] > 0)) return { status: 'error', message: 'Sidlängder måste vara större än 0.' };
  }
  for (const i of knownAngleIdx) {
    if (!(angles[i] > 0 && angles[i] < 180)) {
      return { status: 'error', message: 'Vinklar måste vara mellan 0° och 180°.' };
    }
  }

  const nS = knownSideIdx.length;
  const nA = knownAngleIdx.length;
  if (nS + nA !== 3) return { status: 'incomplete' };

  // Angles only: shape fixed, but not size
  if (nA === 3) {
    const sum = angles[0] + angles[1] + angles[2];
    if (Math.abs(sum - 180) > ANGLE_EPS) {
      return { status: 'error', message: 'Vinklarna måste summera till 180°.' };
    }
    return {
      status: 'insufficient',
      message: 'Vinklarna ger bara formen, inte storleken — fyll i en sida också.',
    };
  }

  // SSS
  if (nS === 3) {
    const [a, b, c] = sides;
    if (a + b <= c || b + c <= a || a + c <= b) {
      return { status: 'error', message: 'Dessa sidlängder kan inte bilda en triangel.' };
    }
    return { status: 'ok', sides: sides.slice(), angles: lawOfCosinesAngles(sides) };
  }

  // One side, two angles
  if (nS === 1 && nA === 2) {
    const sum = knownAngleIdx.reduce((s, i) => s + angles[i], 0);
    if (sum >= 180 - ANGLE_EPS) {
      return { status: 'error', message: 'Vinklarna måste summera till mindre än 180°.' };
    }
    const missingAngle = [0, 1, 2].find((i) => !knownAngleIdx.includes(i));
    angles[missingAngle] = 180 - sum;
    const k = knownSideIdx[0];
    const ratio = sides[k] / Math.sin(toRad(angles[k]));
    for (const i of [0, 1, 2]) {
      if (i !== k) sides[i] = ratio * Math.sin(toRad(angles[i]));
    }
    return { status: 'ok', sides, angles };
  }

  // Two sides + one angle: SAS (unique) or SSA (possibly ambiguous)
  if (nS === 2 && nA === 1) {
    const missingSide = [0, 1, 2].find((i) => !knownSideIdx.includes(i));
    const givenAngle = knownAngleIdx[0];

    if (givenAngle === missingSide) {
      // SAS: given angle is included between the two known sides
      const [j, k] = knownSideIdx;
      const sq = sides[j] ** 2 + sides[k] ** 2 - 2 * sides[j] * sides[k] * Math.cos(toRad(angles[givenAngle]));
      if (sq <= 0) return { status: 'error', message: 'Ingen giltig triangel för dessa värden.' };
      sides[missingSide] = Math.sqrt(sq);
      return { status: 'ok', sides, angles: lawOfCosinesAngles(sides) };
    }

    // SSA: given angle is opposite one of the two known sides
    const j = givenAngle;
    const k = knownSideIdx.find((i) => i !== j);
    const m = missingSide;
    const ratio = (sides[k] * Math.sin(toRad(angles[j]))) / sides[j];

    if (ratio > 1 + RATIO_EPS) return { status: 'error', message: 'Ingen triangel finns för dessa värden.' };

    const clampedRatio = clamp(ratio, -1, 1);
    const isRightAngle = Math.abs(clampedRatio - 1) < 1e-9;
    const base = toDeg(Math.asin(clampedRatio));
    const candidates = isRightAngle ? [90] : [base, 180 - base];

    const solutions = [];
    for (const angK of candidates) {
      const angM = 180 - angles[j] - angK;
      if (angM > ANGLE_EPS) {
        const sideM = (sides[j] * Math.sin(toRad(angM))) / Math.sin(toRad(angles[j]));
        const outSides = sides.slice();
        outSides[m] = sideM;
        const outAngles = angles.slice();
        outAngles[k] = angK;
        outAngles[m] = angM;
        solutions.push({ sides: outSides, angles: outAngles });
      }
    }

    if (solutions.length === 0) return { status: 'error', message: 'Ingen triangel finns för dessa värden.' };
    if (solutions.length === 1) return { status: 'ok', sides: solutions[0].sides, angles: solutions[0].angles };
    return { status: 'ambiguous', solutions };
  }

  return { status: 'error', message: 'Oväntad kombination av värden.' };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// Fixed 3-4-5 triangle, right angle (C) at bottom-right. Never recomputed.
// The long leg is vertical (and the short leg horizontal) so the diagram is
// taller than it is wide — that leaves more horizontal margin on the sides
// for the input fields on a typical (portrait) phone screen.
const LEG_A = 210; // bottom edge B–C, opposite vertex A (short leg, horizontal)
const LEG_B = 280; // right edge A–C, opposite vertex B (long leg, vertical)
const PADDING = 145; // extra room around the shape for larger, easier-to-read inputs
const FIXED_PTS = {
  A: { x: LEG_A, y: 0 },
  B: { x: 0, y: LEG_B },
  C: { x: LEG_A, y: LEG_B },
};
const FIXED_VIEWBOX = { x0: -PADDING, y0: -PADDING, w: LEG_A + 2 * PADDING, h: LEG_B + 2 * PADDING };
const FIXED_CENTROID = {
  x: (FIXED_PTS.A.x + FIXED_PTS.B.x + FIXED_PTS.C.x) / 3,
  y: (FIXED_PTS.A.y + FIXED_PTS.B.y + FIXED_PTS.C.y) / 3,
};

function drawFixedTriangle(svg) {
  svg.setAttribute('viewBox', `${FIXED_VIEWBOX.x0} ${FIXED_VIEWBOX.y0} ${FIXED_VIEWBOX.w} ${FIXED_VIEWBOX.h}`);
  const { A, B, C } = FIXED_PTS;

  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', [A, B, C].map((p) => `${p.x},${p.y}`).join(' '));
  poly.setAttribute('class', 'triangle-shape placeholder');
  svg.appendChild(poly);

  // Right-angle mark at C, tucked into the corner along its two edges
  const dirCA = normalize({ x: A.x - C.x, y: A.y - C.y });
  const dirCB = normalize({ x: B.x - C.x, y: B.y - C.y });
  const markSize = 24;
  const p1 = { x: C.x + dirCA.x * markSize, y: C.y + dirCA.y * markSize };
  const p3 = { x: C.x + dirCB.x * markSize, y: C.y + dirCB.y * markSize };
  const p2 = { x: p1.x + dirCB.x * markSize, y: p1.y + dirCB.y * markSize };
  const mark = document.createElementNS(SVG_NS, 'polyline');
  mark.setAttribute('points', `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`);
  mark.setAttribute('class', 'right-angle-mark');
  svg.appendChild(mark);

  return poly;
}

function positionFixedInputs(inputEls) {
  const { A, B, C } = FIXED_PTS;
  const toPct = (p) => ({
    left: ((p.x - FIXED_VIEWBOX.x0) / FIXED_VIEWBOX.w) * 100,
    top: ((p.y - FIXED_VIEWBOX.y0) / FIXED_VIEWBOX.h) * 100,
  });
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const away = (midpoint, opposite, dist) => {
    const d = normalize({ x: midpoint.x - opposite.x, y: midpoint.y - opposite.y });
    return { x: midpoint.x + d.x * dist, y: midpoint.y + d.y * dist };
  };
  const outward = (p, dist) => {
    const d = normalize({ x: p.x - FIXED_CENTROID.x, y: p.y - FIXED_CENTROID.y });
    return { x: p.x + d.x * dist, y: p.y + d.y * dist };
  };

  const setPos = (el, p) => {
    const { left, top } = toPct(p);
    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
  };

  setPos(inputEls.a, away(mid(B, C), A, 54)); // side a connects B-C, opposite A
  setPos(inputEls.b, away(mid(A, C), B, 54)); // side b connects A-C, opposite B
  setPos(inputEls.c, away(mid(A, B), C, 54)); // side c (hypotenuse) connects A-B, opposite C
  setPos(inputEls.alpha, outward(A, 70));
  setPos(inputEls.beta, outward(B, 70));
}

// ---- UI wiring ----

const svg = document.getElementById('triangle-svg');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');

const inputEls = {
  a: document.getElementById('input-a'),
  b: document.getElementById('input-b'),
  c: document.getElementById('input-c'),
  alpha: document.getElementById('input-alpha'),
  beta: document.getElementById('input-beta'),
};
// Position/state target for each field: the input itself for sides, but the
// wrapping element (input + °) for angles, so the ° suffix moves and styles
// together with its input.
const posEls = {
  a: inputEls.a,
  b: inputEls.b,
  c: inputEls.c,
  alpha: document.getElementById('wrap-alpha'),
  beta: document.getElementById('wrap-beta'),
};
const FIELD_META = {
  a: { group: 'sides', index: 0 },
  b: { group: 'sides', index: 1 },
  c: { group: 'sides', index: 2 },
  alpha: { group: 'angles', index: 0 },
  beta: { group: 'angles', index: 1 },
};
const FIELD_KEYS = Object.keys(FIELD_META);

let givenFields = new Set();
const trianglePoly = drawFixedTriangle(svg);
positionFixedInputs(posEls);

function setStatus(message, kind) {
  statusEl.textContent = message || '';
  statusEl.className = kind ? `status ${kind}` : 'status';
}

function setSolved(isSolved) {
  trianglePoly.classList.toggle('placeholder', !isSolved);
}

function setFieldClass(key, cls, on) {
  inputEls[key].classList.toggle(cls, on);
  if (posEls[key] !== inputEls[key]) posEls[key].classList.toggle(cls, on);
}

function readGivenValues() {
  const sides = [null, null, null];
  const angles = [null, null, RIGHT_ANGLE];
  for (const key of givenFields) {
    const meta = FIELD_META[key];
    const value = parseFloat(inputEls[key].value);
    if (meta.group === 'sides') sides[meta.index] = value;
    else angles[meta.index] = value;
  }
  return { sides, angles };
}

function markFieldStyles() {
  for (const key of FIELD_KEYS) {
    const isGiven = givenFields.has(key);
    setFieldClass(key, 'given', isGiven);
    if (isGiven) setFieldClass(key, 'computed', false);
  }
}

function clearComputedFields() {
  for (const key of FIELD_KEYS) {
    if (!givenFields.has(key)) {
      inputEls[key].value = '';
      setFieldClass(key, 'computed', false);
    }
  }
}

function fillComputed(sides, angles) {
  ['a', 'b', 'c'].forEach((key, i) => {
    if (givenFields.has(key)) return;
    inputEls[key].value = fmt(sides[i]);
    setFieldClass(key, 'computed', true);
  });
  ['alpha', 'beta'].forEach((key, i) => {
    if (givenFields.has(key)) return;
    inputEls[key].value = fmt(angles[i]);
    setFieldClass(key, 'computed', true);
  });
}

function recompute() {
  markFieldStyles();
  clearComputedFields();

  const known = givenFields.size;
  if (known < 2) {
    setStatus('');
    setSolved(false);
    return;
  }
  if (known > 2) {
    setStatus('För många värden — töm ett fält.', 'error');
    setSolved(false);
    return;
  }

  const { sides, angles } = readGivenValues();
  const result = solveTriangle(sides, angles);

  if (result.status === 'ok') {
    setStatus('');
    setSolved(true);
    fillComputed(result.sides, result.angles);
  } else if (result.status === 'ambiguous') {
    // Not reachable with a fixed right angle, but handled defensively.
    const sol = result.solutions[0];
    setStatus('');
    setSolved(true);
    fillComputed(sol.sides, sol.angles);
  } else {
    setStatus(result.message, 'error');
    setSolved(false);
  }
}

function handleFieldInput(key) {
  const raw = inputEls[key].value.trim();
  if (raw === '' || Number.isNaN(parseFloat(raw))) givenFields.delete(key);
  else givenFields.add(key);
  recompute();
}

function handleReset() {
  for (const key of FIELD_KEYS) {
    inputEls[key].value = '';
    setFieldClass(key, 'given', false);
    setFieldClass(key, 'computed', false);
  }
  givenFields = new Set();
  recompute();
}

FIELD_KEYS.forEach((key) => {
  inputEls[key].addEventListener('input', () => handleFieldInput(key));
});
resetBtn.addEventListener('click', handleReset);

recompute();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
