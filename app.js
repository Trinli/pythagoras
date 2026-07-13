'use strict';

/*
 * General triangle solver. Indexing convention: index 0/1/2 = a/b/c and
 * alpha/beta/gamma. Side i is always opposite angle i. The user fills in
 * any 3 of the 6 values (sides and/or angles); the other 3 are computed.
 * The diagram redraws to the actual solved shape and just labels which
 * side/angle is which — the real values live in the 6 fields below it.
 */

const ANGLE_EPS = 1e-6; // degrees
const RATIO_EPS = 1e-9;

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function fmt(n) { return Math.round(n * 100) / 100; }
function fmtAngle(n) { return Math.round(n * 10) / 10; }

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
      message: 'Tre vinklar ger bara formen, inte storleken — fyll i en sida också.',
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

    // SSA: given angle is opposite one of the two known sides — ambiguous case
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
const PADDING = 55;

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

function addText(svg, x, y, str, cls) {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('class', cls);
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('dominant-baseline', 'middle');
  t.textContent = str;
  svg.appendChild(t);
}

function drawTriangle(svg, sides, angles, { placeholder = false } = {}) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const layout = computeLayout(sides, angles);
  const { viewBox, pts, centroid } = layout;
  svg.setAttribute('viewBox', `${viewBox.x0} ${viewBox.y0} ${viewBox.w} ${viewBox.h}`);

  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
  poly.setAttribute('class', placeholder ? 'triangle-shape placeholder' : 'triangle-shape');
  svg.appendChild(poly);

  // Angle labels (α, β, γ), offset outward past each vertex so they never
  // sit on top of the triangle's edges.
  const angleLabels = ['α', 'β', 'γ'];
  pts.forEach((p, i) => {
    const dir = normalize({ x: p.x - centroid.x, y: p.y - centroid.y });
    const pos = { x: p.x + dir.x * 30, y: p.y + dir.y * 30 };
    addText(svg, pos.x, pos.y, angleLabels[i], placeholder ? 'angle-label placeholder' : 'angle-label');
  });

  // Side labels (a, b, c) at midpoints, offset away from the opposite vertex
  const sideLabels = ['a', 'b', 'c'];
  const pairs = [
    [1, 2, 0], // side a connects pts[1]-pts[2], opposite pts[0]
    [0, 2, 1], // side b connects pts[0]-pts[2], opposite pts[1]
    [0, 1, 2], // side c connects pts[0]-pts[1], opposite pts[2]
  ];
  pairs.forEach(([p1, p2, opp], i) => {
    const mid = { x: (pts[p1].x + pts[p2].x) / 2, y: (pts[p1].y + pts[p2].y) / 2 };
    const away = normalize({ x: mid.x - pts[opp].x, y: mid.y - pts[opp].y });
    const pos = { x: mid.x + away.x * 22, y: mid.y + away.y * 22 };
    addText(svg, pos.x, pos.y, sideLabels[i], placeholder ? 'side-label placeholder' : 'side-label');
  });

  return poly;
}

// ---- UI wiring ----

const svg = document.getElementById('triangle-svg');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');
const solutionToggle = document.getElementById('solution-toggle');

const inputEls = {
  a: document.getElementById('input-a'),
  b: document.getElementById('input-b'),
  c: document.getElementById('input-c'),
  alpha: document.getElementById('input-alpha'),
  beta: document.getElementById('input-beta'),
  gamma: document.getElementById('input-gamma'),
};
// Position/state target for each field: the input itself for sides, but the
// wrapping element (input + °) for angles, so the ° suffix styles together
// with its input.
const posEls = {
  a: inputEls.a,
  b: inputEls.b,
  c: inputEls.c,
  alpha: document.getElementById('wrap-alpha'),
  beta: document.getElementById('wrap-beta'),
  gamma: document.getElementById('wrap-gamma'),
};
const FIELD_META = {
  a: { group: 'sides', index: 0 },
  b: { group: 'sides', index: 1 },
  c: { group: 'sides', index: 2 },
  alpha: { group: 'angles', index: 0 },
  beta: { group: 'angles', index: 1 },
  gamma: { group: 'angles', index: 2 },
};
const FIELD_KEYS = Object.keys(FIELD_META);

let givenFields = new Set();
let lastAmbiguous = null;
let selectedSolution = 0;

const PLACEHOLDER_SIDES = [3, 4, 5];
const PLACEHOLDER_ANGLES = lawOfCosinesAngles(PLACEHOLDER_SIDES);

function setStatus(message, kind) {
  statusEl.textContent = message || '';
  statusEl.className = kind ? `status ${kind}` : 'status';
}

function setFieldClass(key, cls, on) {
  inputEls[key].classList.toggle(cls, on);
  if (posEls[key] !== inputEls[key]) posEls[key].classList.toggle(cls, on);
}

function readGivenValues() {
  const sides = [null, null, null];
  const angles = [null, null, null];
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
  ['alpha', 'beta', 'gamma'].forEach((key, i) => {
    if (givenFields.has(key)) return;
    inputEls[key].value = fmtAngle(angles[i]);
    setFieldClass(key, 'computed', true);
  });
}

function showSolution(sides, angles, { placeholder = false } = {}) {
  drawTriangle(svg, sides, angles, { placeholder });
  if (!placeholder) fillComputed(sides, angles);
}

function recompute() {
  markFieldStyles();
  clearComputedFields();
  solutionToggle.hidden = true;
  lastAmbiguous = null;

  const known = givenFields.size;
  if (known < 3) {
    setStatus(`Fyll i ${3 - known} värde${3 - known === 1 ? '' : 'n'} till (valfri blandning av sidor och vinklar).`);
    showSolution(PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
    return;
  }
  if (known > 3) {
    setStatus('För många värden — töm ett fält.', 'error');
    showSolution(PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
    return;
  }

  const { sides, angles } = readGivenValues();
  const result = solveTriangle(sides, angles);

  if (result.status === 'ok') {
    setStatus('');
    showSolution(result.sides, result.angles);
  } else if (result.status === 'ambiguous') {
    lastAmbiguous = result;
    selectedSolution = 0;
    solutionToggle.hidden = false;
    solutionToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', Number(b.dataset.solution) === 0));
    setStatus('Två trianglar uppfyller dessa värden — välj en lösning nedan.', 'ambiguous');
    showSolution(result.solutions[0].sides, result.solutions[0].angles);
  } else {
    setStatus(result.message, 'error');
    showSolution(PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
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

solutionToggle.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!lastAmbiguous) return;
    selectedSolution = Number(btn.dataset.solution);
    solutionToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    const sol = lastAmbiguous.solutions[selectedSolution];
    showSolution(sol.sides, sol.angles);
  });
});

recompute();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
