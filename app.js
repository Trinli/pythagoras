'use strict';

/*
 * Indexing convention: index 0/1/2 = a/b/c and alpha/beta/gamma.
 * Side i is always opposite angle i. Gamma (index 2) is permanently 90°:
 * this app only solves right triangles, so the app only ever asks for 2
 * of the remaining 5 values (a, b, c, alpha, beta) — gamma is the 3rd,
 * implicit, always-known value the solver needs.
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

/** Place vertices A=(0,0), B=(c,0), C above the baseline. */
function computePoints(sides, angles) {
  const [, b] = sides;
  const alpha = angles[0];
  const A = { x: 0, y: 0 };
  const B = { x: sides[2], y: 0 };
  const C = { x: b * Math.cos(toRad(alpha)), y: -b * Math.sin(toRad(alpha)) };
  return { A, B, C };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const DISPLAY_SIZE = 300;
const PADDING = 70;

function computeLayout(sides, angles) {
  const { A, B, C } = computePoints(sides, angles);
  const rawPts = [A, B, C];
  const minX = Math.min(...rawPts.map((p) => p.x));
  const maxX = Math.max(...rawPts.map((p) => p.x));
  const minY = Math.min(...rawPts.map((p) => p.y));
  const maxY = Math.max(...rawPts.map((p) => p.y));
  const rawW = Math.max(maxX - minX, 1e-6);
  const rawH = Math.max(maxY - minY, 1e-6);
  const scale = DISPLAY_SIZE / Math.max(rawW, rawH);

  const pts = rawPts.map((p) => ({ x: (p.x - minX) * scale, y: (p.y - minY) * scale }));
  const w = rawW * scale;
  const h = rawH * scale;
  const centroid = {
    x: (pts[0].x + pts[1].x + pts[2].x) / 3,
    y: (pts[0].y + pts[1].y + pts[2].y) / 3,
  };

  return { pts, centroid, viewBox: { x0: -PADDING, y0: -PADDING, w: w + 2 * PADDING, h: h + 2 * PADDING } };
}

function drawTriangle(svg, layout, { placeholder = false } = {}) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const { viewBox, pts } = layout;
  svg.setAttribute('viewBox', `${viewBox.x0} ${viewBox.y0} ${viewBox.w} ${viewBox.h}`);

  const [A, B, C] = pts;

  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
  poly.setAttribute('class', placeholder ? 'triangle-shape placeholder' : 'triangle-shape');
  svg.appendChild(poly);

  // Right-angle mark at C, tucked into the corner along its two edges
  const dirCA = normalize({ x: A.x - C.x, y: A.y - C.y });
  const dirCB = normalize({ x: B.x - C.x, y: B.y - C.y });
  const markSize = 18;
  const p1 = { x: C.x + dirCA.x * markSize, y: C.y + dirCA.y * markSize };
  const p3 = { x: C.x + dirCB.x * markSize, y: C.y + dirCB.y * markSize };
  const p2 = { x: p1.x + dirCB.x * markSize, y: p1.y + dirCB.y * markSize };
  const mark = document.createElementNS(SVG_NS, 'polyline');
  mark.setAttribute('points', `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`);
  mark.setAttribute('class', placeholder ? 'right-angle-mark placeholder' : 'right-angle-mark');
  svg.appendChild(mark);
}

function positionInputs(layout, inputEls) {
  const { pts, centroid, viewBox } = layout;
  const [A, B, C] = pts;

  const toPct = (p) => ({ left: ((p.x - viewBox.x0) / viewBox.w) * 100, top: ((p.y - viewBox.y0) / viewBox.h) * 100 });
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const away = (midpoint, opposite, dist) => {
    const d = normalize({ x: midpoint.x - opposite.x, y: midpoint.y - opposite.y });
    return { x: midpoint.x + d.x * dist, y: midpoint.y + d.y * dist };
  };
  const outward = (p, dist) => {
    const d = normalize({ x: p.x - centroid.x, y: p.y - centroid.y });
    return { x: p.x + d.x * dist, y: p.y + d.y * dist };
  };

  const setPos = (el, p) => {
    const { left, top } = toPct(p);
    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
  };

  setPos(inputEls.a, away(mid(B, C), A, 34)); // side a connects B-C, opposite A
  setPos(inputEls.b, away(mid(A, C), B, 34)); // side b connects A-C, opposite B
  setPos(inputEls.c, away(mid(A, B), C, 34)); // side c (hypotenuse) connects A-B, opposite C
  setPos(inputEls.alpha, outward(A, 40));
  setPos(inputEls.beta, outward(B, 40));
}

// ---- UI wiring ----

const wrap = document.getElementById('triangle-wrap');
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
const FIELD_META = {
  a: { group: 'sides', index: 0 },
  b: { group: 'sides', index: 1 },
  c: { group: 'sides', index: 2 },
  alpha: { group: 'angles', index: 0 },
  beta: { group: 'angles', index: 1 },
};
const FIELD_KEYS = Object.keys(FIELD_META);

let givenFields = new Set();

const PLACEHOLDER_SIDES = [3, 4, 5];
const PLACEHOLDER_ANGLES = lawOfCosinesAngles(PLACEHOLDER_SIDES);

function setStatus(message, kind) {
  statusEl.textContent = message || '';
  statusEl.className = kind ? `status ${kind}` : 'status';
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
    inputEls[key].classList.toggle('given', isGiven);
    if (isGiven) inputEls[key].classList.remove('computed');
  }
}

function clearComputedFields() {
  for (const key of FIELD_KEYS) {
    if (!givenFields.has(key)) {
      inputEls[key].value = '';
      inputEls[key].classList.remove('computed');
    }
  }
}

function fillComputed(sides, angles) {
  ['a', 'b', 'c'].forEach((key, i) => {
    if (givenFields.has(key)) return;
    inputEls[key].value = fmt(sides[i]);
    inputEls[key].classList.add('computed');
  });
  ['alpha', 'beta'].forEach((key, i) => {
    if (givenFields.has(key)) return;
    inputEls[key].value = fmt(angles[i]);
    inputEls[key].classList.add('computed');
  });
}

function applyLayout(sides, angles, { placeholder = false } = {}) {
  const layout = computeLayout(sides, angles);
  wrap.style.aspectRatio = `${layout.viewBox.w} / ${layout.viewBox.h}`;
  drawTriangle(svg, layout, { placeholder });
  positionInputs(layout, inputEls);
}

function recompute() {
  markFieldStyles();
  clearComputedFields();

  const known = givenFields.size;
  if (known < 2) {
    setStatus('');
    applyLayout(PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
    return;
  }
  if (known > 2) {
    setStatus('För många värden — töm ett fält.', 'error');
    applyLayout(PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
    return;
  }

  const { sides, angles } = readGivenValues();
  const result = solveTriangle(sides, angles);

  if (result.status === 'ok') {
    setStatus('');
    applyLayout(result.sides, result.angles);
    fillComputed(result.sides, result.angles);
  } else if (result.status === 'ambiguous') {
    // Not reachable with a fixed right angle, but handled defensively.
    const sol = result.solutions[0];
    setStatus('');
    applyLayout(sol.sides, sol.angles);
    fillComputed(sol.sides, sol.angles);
  } else {
    setStatus(result.message, 'error');
    applyLayout(PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
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
    inputEls[key].classList.remove('given', 'computed');
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
