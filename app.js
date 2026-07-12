'use strict';

/*
 * Indexing convention: index 0/1/2 = a/b/c and alpha/beta/gamma.
 * Side i is always opposite angle i.
 */

const ANGLE_EPS = 1e-6; // degrees
const RATIO_EPS = 1e-9;

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

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
 *   { status: 'incomplete' }                              fewer/more than 3 known
 *   { status: 'insufficient', message }                    AAA only
 *   { status: 'error', message }                            invalid combination
 *   { status: 'ok', sides, angles }                         unique solution
 *   { status: 'ambiguous', solutions: [{sides,angles}, ...] } SSA with 2 solutions
 */
function solveTriangle(sidesIn, anglesIn) {
  const sides = sidesIn.slice();
  const angles = anglesIn.slice();
  const knownSideIdx = [0, 1, 2].filter((i) => sides[i] != null);
  const knownAngleIdx = [0, 1, 2].filter((i) => angles[i] != null);

  for (const i of knownSideIdx) {
    if (!(sides[i] > 0)) return { status: 'error', message: 'Side lengths must be greater than 0.' };
  }
  for (const i of knownAngleIdx) {
    if (!(angles[i] > 0 && angles[i] < 180)) {
      return { status: 'error', message: 'Angles must be between 0° and 180°.' };
    }
  }

  const nS = knownSideIdx.length;
  const nA = knownAngleIdx.length;
  if (nS + nA !== 3) return { status: 'incomplete' };

  // AAA: shape only, no unique size
  if (nA === 3) {
    const sum = angles[0] + angles[1] + angles[2];
    if (Math.abs(sum - 180) > ANGLE_EPS) {
      return { status: 'error', message: 'The three angles must add up to 180°.' };
    }
    return {
      status: 'insufficient',
      message: 'Three angles fix the shape but not the size — enter a side length for a unique triangle.',
    };
  }

  // SSS
  if (nS === 3) {
    const [a, b, c] = sides;
    if (a + b <= c || b + c <= a || a + c <= b) {
      return { status: 'error', message: "These three side lengths can't form a triangle." };
    }
    return { status: 'ok', sides: sides.slice(), angles: lawOfCosinesAngles(sides) };
  }

  // ASA / AAS: one side, two angles
  if (nS === 1 && nA === 2) {
    const sum = knownAngleIdx.reduce((s, i) => s + angles[i], 0);
    if (sum >= 180 - ANGLE_EPS) {
      return { status: 'error', message: 'The two given angles must add to less than 180°.' };
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

  // Two sides + one angle: SAS (unique) or SSA (ambiguous)
  if (nS === 2 && nA === 1) {
    const missingSide = [0, 1, 2].find((i) => !knownSideIdx.includes(i));
    const givenAngle = knownAngleIdx[0];

    if (givenAngle === missingSide) {
      // SAS: given angle is included between the two known sides
      const [j, k] = knownSideIdx;
      const sq = sides[j] ** 2 + sides[k] ** 2 - 2 * sides[j] * sides[k] * Math.cos(toRad(angles[givenAngle]));
      if (sq <= 0) return { status: 'error', message: 'No valid triangle for these values.' };
      sides[missingSide] = Math.sqrt(sq);
      return { status: 'ok', sides, angles: lawOfCosinesAngles(sides) };
    }

    // SSA: given angle is opposite one of the two known sides — ambiguous case
    const j = givenAngle;
    const k = knownSideIdx.find((i) => i !== j);
    const m = missingSide;
    const ratio = (sides[k] * Math.sin(toRad(angles[j]))) / sides[j];

    if (ratio > 1 + RATIO_EPS) return { status: 'error', message: 'No triangle exists for these values.' };

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

    if (solutions.length === 0) return { status: 'error', message: 'No triangle exists for these values.' };
    if (solutions.length === 1) return { status: 'ok', sides: solutions[0].sides, angles: solutions[0].angles };
    return { status: 'ambiguous', solutions };
  }

  return { status: 'error', message: 'Unexpected combination of inputs.' };
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

const SVG_NS = 'http://www.w3.org/2000/svg';
const DISPLAY_SIZE = 300;
const PADDING = 70;

function fmt(n) {
  return Math.round(n * 100) / 100;
}

function renderTriangle(svg, sides, angles, { placeholder = false } = {}) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

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
  svg.setAttribute('viewBox', `${-PADDING} ${-PADDING} ${w + 2 * PADDING} ${h + 2 * PADDING}`);

  const centroid = {
    x: (pts[0].x + pts[1].x + pts[2].x) / 3,
    y: (pts[0].y + pts[1].y + pts[2].y) / 3,
  };

  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
  poly.setAttribute('class', placeholder ? 'triangle-shape placeholder' : 'triangle-shape');
  svg.appendChild(poly);

  if (placeholder) return;

  // Angle labels, offset outward past each vertex so they never cross the triangle
  pts.forEach((p, i) => {
    const dir = normalize({ x: p.x - centroid.x, y: p.y - centroid.y });
    const anglePos = { x: p.x + dir.x * 30, y: p.y + dir.y * 30 };
    addText(svg, anglePos.x, anglePos.y, `${fmt(angles[i])}°`, 'angle-label');
  });

  // Side labels at midpoints, offset away from the opposite vertex
  const pairs = [
    [1, 2, 0], // side a connects B(1)-C(2), opposite A(0)
    [0, 2, 1], // side b connects A(0)-C(2), opposite B(1)
    [0, 1, 2], // side c connects A(0)-B(1), opposite C(2)
  ];
  pairs.forEach(([p1, p2, opp], sideIdx) => {
    const mid = { x: (pts[p1].x + pts[p2].x) / 2, y: (pts[p1].y + pts[p2].y) / 2 };
    const away = normalize({ x: mid.x - pts[opp].x, y: mid.y - pts[opp].y });
    const pos = { x: mid.x + away.x * 20, y: mid.y + away.y * 20 };
    addText(svg, pos.x, pos.y, fmt(sides[sideIdx]).toString(), 'side-label');
  });
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
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

// ---- UI wiring ----

const FIELD_META = {
  'side-a': { group: 'sides', index: 0 },
  'side-b': { group: 'sides', index: 1 },
  'side-c': { group: 'sides', index: 2 },
  'angle-alpha': { group: 'angles', index: 0 },
  'angle-beta': { group: 'angles', index: 1 },
  'angle-gamma': { group: 'angles', index: 2 },
};
const ALL_FIELD_IDS = Object.keys(FIELD_META);
const DEFAULT_GIVEN = { 'angle-gamma': '90' };

const svg = document.getElementById('triangle-svg');
const statusEl = document.getElementById('status');
const solutionToggle = document.getElementById('solution-toggle');
const resetBtn = document.getElementById('reset-btn');

let givenFields = new Set();
let lastAmbiguous = null;
let selectedSolution = 0;

const PLACEHOLDER_SIDES = [3, 4, 5];
const PLACEHOLDER_ANGLES = lawOfCosinesAngles(PLACEHOLDER_SIDES);

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = kind ? `status ${kind}` : 'status';
}

function readGivenValues() {
  const sides = [null, null, null];
  const angles = [null, null, null];
  for (const id of givenFields) {
    const meta = FIELD_META[id];
    const value = parseFloat(document.getElementById(id).value);
    if (meta.group === 'sides') sides[meta.index] = value;
    else angles[meta.index] = value;
  }
  return { sides, angles };
}

function markFieldStyles() {
  for (const id of ALL_FIELD_IDS) {
    const el = document.getElementById(id);
    el.classList.toggle('given', givenFields.has(id));
  }
}

function clearComputedFields() {
  for (const id of ALL_FIELD_IDS) {
    if (!givenFields.has(id)) {
      const el = document.getElementById(id);
      el.value = '';
      el.classList.remove('computed');
    }
  }
}

function fillComputed(sides, angles) {
  ['side-a', 'side-b', 'side-c'].forEach((id, i) => {
    if (givenFields.has(id)) return;
    const el = document.getElementById(id);
    el.value = fmt(sides[i]);
    el.classList.add('computed');
  });
  ['angle-alpha', 'angle-beta', 'angle-gamma'].forEach((id, i) => {
    if (givenFields.has(id)) return;
    const el = document.getElementById(id);
    el.value = fmt(angles[i]);
    el.classList.add('computed');
  });
}

function showSolution(sol) {
  renderTriangle(svg, sol.sides, sol.angles);
  fillComputed(sol.sides, sol.angles);
}

function recompute() {
  markFieldStyles();
  clearComputedFields();
  solutionToggle.hidden = true;
  lastAmbiguous = null;

  const known = givenFields.size;
  if (known < 3) {
    setStatus(`Enter ${3 - known} more value${3 - known === 1 ? '' : 's'} (any mix of sides and angles).`);
    renderTriangle(svg, PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
    return;
  }
  if (known > 3) {
    setStatus('Only 3 values are needed — clear one field.', 'error');
    renderTriangle(svg, PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
    return;
  }

  const { sides, angles } = readGivenValues();
  const result = solveTriangle(sides, angles);

  if (result.status === 'ambiguous') {
    lastAmbiguous = result;
    selectedSolution = 0;
    solutionToggle.hidden = false;
    solutionToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', Number(b.dataset.solution) === 0));
    setStatus('Two triangles satisfy these values — pick a solution below.', 'ambiguous');
    showSolution(result.solutions[0]);
  } else if (result.status === 'ok') {
    setStatus('Triangle solved.', 'ok');
    showSolution(result);
  } else {
    setStatus(result.message, 'error');
    renderTriangle(svg, PLACEHOLDER_SIDES, PLACEHOLDER_ANGLES, { placeholder: true });
  }
}

function handleFieldInput(id) {
  const raw = document.getElementById(id).value.trim();
  if (raw === '' || Number.isNaN(parseFloat(raw))) givenFields.delete(id);
  else givenFields.add(id);
  recompute();
}

function resetToDefault() {
  for (const id of ALL_FIELD_IDS) {
    const el = document.getElementById(id);
    el.value = DEFAULT_GIVEN[id] || '';
    el.classList.remove('computed', 'given');
  }
  givenFields = new Set(Object.keys(DEFAULT_GIVEN));
  recompute();
}

ALL_FIELD_IDS.forEach((id) => {
  document.getElementById(id).addEventListener('input', () => handleFieldInput(id));
});
resetBtn.addEventListener('click', resetToDefault);

solutionToggle.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!lastAmbiguous) return;
    selectedSolution = Number(btn.dataset.solution);
    solutionToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    showSolution(lastAmbiguous.solutions[selectedSolution]);
  });
});

resetToDefault();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
