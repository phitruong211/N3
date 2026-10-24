'use client'

/**
 * ink-ridges — a sumi-e mountain range painted in front of you. Layered ridges,
 * far to near, each laid down with a brush sweep that presses hardest along the
 * crest; ink thins toward every foot and mist drifts between them, under a
 * washed sky with a few brush-streak clouds. Last, a red sun blooms like a drop
 * of pigment, a wisp of mist across it; on dark paper it is a pale moon. Every
 * so often a small flock of birds crosses, gliding along a ridge. Scroll away
 * and the far ridges lag while the sun sets behind them. Every seed paints a
 * different range. Use it as a hero or section background: children render on top.
 *
 * Install
 *   npx @21st-dev/cli add @ryanonline1234/ink-ridges   (needs a free 21st.dev API key)
 *   React 19 and nothing else. Tailwind v4 for a few utility classes. The paper
 *   is the nearest background behind it (else white) and the ink is the text
 *   color, so it follows light and dark themes with no configuration.
 *
 * Frame budget
 *   It draws only while something moves: the paint-in, drifting mist, a flock
 *   in flight, a scroll, or the pointer settling. Offscreen, in a hidden tab, or
 *   with drift and parallax at 0 it draws nothing. prefers-reduced-motion shows
 *   the finished landscape as one static frame, without birds or scroll depth.
 *
 * Frameworks
 *   Next.js App Router: a Client Component ('use client' above). Vite: nothing extra.
 *
 * Provenance: the GLSL is authored here from first principles (integer hash,
 * value noise, fbm, a ridged term for sharper peaks). The brush curve is the
 * ink easing curve (0.7, 0, 0.2, 1), observed on oneshot-sakura.vercel.app.
 * MIT — https://github.com/ryanonline1234/ease-atlas
 */

import * as React from 'react'

/* ----------------------------- pure parts ------------------------------- */

type RGB = [number, number, number]
const MAX_LAYERS = 5
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

export interface Layer {
  /** Ridge-line height, 0 bottom to 1 top. */
  base: number
  /** How far the ridge line rises and falls around its base. */
  amp: number
  /** Horizontal frequency of the peaks. */
  freq: number
  /** Ink density at the ridge line. */
  ink: number
  /** 0 for the farthest ridge, 1 for the nearest. */
  depth: number
}

/** Ridge i of n: the far ridge sits at the horizon; nearer ridges are lower, taller, busier and darker. */
export function layerAt(i: number, n: number, horizon: number): Layer {
  const depth = n <= 1 ? 1 : i / (n - 1)
  const h = Math.min(0.82, Math.max(0.3, horizon))
  return {
    base: n <= 1 ? h : h - (h - 0.2) * depth,
    amp: 0.07 + 0.06 * depth,
    freq: 1.3 + 1.9 * depth,
    ink: 0.22 + 0.5 * depth,
    depth,
  }
}

/** How far ridge i of n has been brushed in at overall progress p. The far ridge starts first. */
export function paintAt(p: number, i: number, n: number): number {
  if (n <= 1) return clamp01(p)
  const stagger = Math.min(0.18, 0.6 / (n - 1))
  const span = 1 - stagger * (n - 1)
  return clamp01((p - i * stagger) / span)
}

/** Ink density for a paper color: full on light paper, eased off on dark paper so light ink reads as moonlight. */
export function inkScaleFor(paper: [number, number, number]): number {
  const lum = 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2]
  return lum < 0.35 ? 0.62 + (lum / 0.35) * 0.38 : 1
}

/** How far the sun has bloomed at overall progress p: it is the last touch, spreading like a drop of pigment. */
export function sunBloom(p: number): number {
  const t = clamp01((p - 0.55) / 0.4)
  return 1 - (1 - t) ** 3
}

/** Whether to paint the moon: always, never, or ('auto') whenever the paper is dark. */
export function moonFor(moon: boolean | 'auto', paper: [number, number, number]): boolean {
  if (moon !== 'auto') return moon
  return 0.2126 * paper[0] + 0.7152 * paper[1] + 0.0722 * paper[2] < 0.35
}

/**
 * How far the far ridge sinks (uv) once the top of the frame has scrolled `scrolled` px past the
 * viewport top: nearer ridges ride with the page, farther ones lag, and the sun sinks fastest.
 */
export function scrollDrop(scrolled: number, height: number, strength: number): number {
  return clamp01(scrolled / Math.max(1, height)) * Math.max(0, strength)
}

/* The shader's noise, ported so the flock can follow a ridge line exactly. */

function hashU(x: number, y: number): number {
  let n = (Math.imul(x, 1664525) ^ (Math.imul(y, 22695477) + 12345)) >>> 0
  n = (n ^ (n >>> 15)) >>> 0
  n = Math.imul(n, 2246822519) >>> 0
  n = (n ^ (n >>> 13)) >>> 0
  n = Math.imul(n, 3266489917) >>> 0
  n = (n ^ (n >>> 16)) >>> 0
  return n
}
/** Mirrors the GLSL hash2: one value per integer cell, in [0, 1]. */
export function hash2(x: number, y: number): number {
  return hashU(Math.floor(x) + 32768, Math.floor(y) + 32768) / 4294967295
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export function vnoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  return mix(mix(hash2(ix, iy), hash2(ix + 1, iy), ux), mix(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), ux), uy)
}
/** Mirrors the GLSL fbm: five octaves, the same rotation and offsets. */
export function fbm(x: number, y: number): number {
  let v = 0
  let a = 0.5
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(x, y)
    const nx = (0.8 * x - 0.6 * y) * 2.03 + 11.7
    const ny = (0.6 * x + 0.8 * y) * 2.03 + 11.7
    x = nx
    y = ny
    a *= 0.5
  }
  return v
}

export interface RidgeOpts {
  n: number
  horizon: number
  seed: number
  aspect: number
  shift: [number, number]
  /** scrollDrop(): how far the far ridge has sunk on scroll. */
  drop?: number
}

/** Height (uv, bottom 0 to top 1) of ridge i's line at uv x, exactly as the shader draws it. */
export function ridgeLineAt(i: number, uvx: number, o: RidgeOpts): number {
  const L = layerAt(i, o.n, o.horizon)
  const k = 0.25 + L.depth
  const x = (uvx + o.shift[0] * k) * o.aspect
  const n = fbm(x * L.freq + o.seed * 1.37 + i * 7.31, i * 3.7 + o.seed * 0.71)
  const ridged = 1 - Math.abs(2 * vnoise(x * L.freq * 2.3 + i * 5.1 + o.seed, i + o.seed * 0.3) - 1)
  const h = L.base + L.amp * ((n - 0.5) * 2 + (ridged - 0.5) * 0.35)
  return h - o.shift[1] * k - (o.drop ?? 0) * (1 - L.depth)
}

export interface Flight {
  /** ms timestamp the flight began (only used by the component). */
  start: number
  /** seconds to cross the frame */
  duration: number
  dir: 1 | -1
  count: number
  /** the ridge the flock follows */
  layer: number
  seed: number
}
export interface Bird {
  x: number
  y: number
  /** half wingspan as a fraction of the frame height */
  size: number
  /** wingtip lift: positive up, negative down */
  flap: number
}

/** The flock t seconds into a flight: a loose V that follows ridge `layer`, flapping and gliding. */
export function birdsAt(f: Flight, t: number, o: RidgeOpts): { alpha: number; birds: Bird[] } {
  const u = clamp01(t / f.duration)
  const lead = f.dir > 0 ? -0.12 + 1.3 * u : 1.12 - 1.3 * u
  const alpha = clamp01(Math.min(u / 0.08, (1 - u) / 0.08, 1))
  const L = layerAt(f.layer, o.n, o.horizon)
  const cruise = L.base + L.amp
  const birds: Bird[] = []
  for (let k = 0; k < f.count; k++) {
    const rank = Math.ceil(k / 2)
    const side = k === 0 ? 0 : k % 2 ? 1 : -1
    const r = hash2(k * 3.1 + f.seed * 7.7, f.seed * 1.3 + k)
    const x = lead - f.dir * rank * (0.028 + 0.008 * r)
    const ridge = ridgeLineAt(f.layer, x, o)
    const bob = 0.005 * Math.sin(t * 1.6 + k * 1.9)
    const y = Math.max(ridge + 0.07, 0.5 * (cruise + ridge) + 0.08) + side * rank * 0.018 + bob
    const glide = 0.5 + 0.5 * Math.sin(t * 0.8 + k * 2.3)
    const flap = (0.15 + 0.4 * glide) * Math.sin(t * (8 + 2 * r) + k * 1.3)
    birds.push({ x, y, size: 0.011 + 0.004 * r, flap })
  }
  return { alpha, birds }
}

/** Exponential smoothing that behaves the same at 60 Hz and 120 Hz. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let t = x
    for (let i = 0; i < 40; i++) {
      t = (lo + hi) / 2
      if (bx(t) < x) lo = t
      else hi = t
    }
    return by(t)
  }
}
const ink = cubicBezier(0.7, 0, 0.2, 1) // observed · oneshot-sakura.vercel.app

/** #rgb, #rrggbb, rgb(), rgba() → unit floats; null for transparent and for formats that need a browser. */
export function colorToRgb(css: string): RGB | null {
  const s = css.trim()
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (m) {
    const hex = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as RGB
  }
  if (/^transparent$/i.test(s)) return null
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)/i)
  if (m) {
    if (m[4] !== undefined && Number(m[4]) === 0) return null
    return [+m[1]! / 255, +m[2]! / 255, +m[3]! / 255]
  }
  return null
}

function resolveCssColor(v: string): RGB | null {
  const direct = colorToRgb(v)
  if (direct) return direct
  if (/^transparent$/i.test(v.trim()) || /^rgba?\([^)]*[,/]\s*0\s*\)$/i.test(v.trim())) return null
  try {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const ctx = cv.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000'
    ctx.fillStyle = v
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    if (d[3] === 0) return null
    return [d[0]! / 255, d[1]! / 255, d[2]! / 255]
  } catch {
    return null
  }
}

/** The element's own color, or for a transparent background the nearest ancestor's, else a default. */
function resolveColor(el: Element, prop: 'color' | 'backgroundColor'): RGB {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const rgb = resolveCssColor(getComputedStyle(n)[prop])
    if (rgb) return rgb
    if (prop === 'color') break
  }
  return prop === 'color' ? [0.1, 0.1, 0.1] : [1, 1, 1]
}

/* ----------------------------- shader ----------------------------------- */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

// Authored here. Each ridge line is fbm plus a ridged term for sharper peaks;
// below it, ink thins toward the foot and is broken by brush texture, with more
// pressure along the crest; drifting low-frequency fbm lifts mist out of each
// foot; a ragged left-to-right sweep lays each ridge down. The sun is a disc with
// a noise-wobbled edge, pigment pooled at the rim and granulation inside, crossed
// by a wisp of mist; the far ridge paints over it. Grain on top.
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uSeed;
uniform float uMist;
uniform float uDrift;
uniform float uGrain;
uniform int uLayers;
uniform vec4 uLayer[5];
uniform float uPaint[5];
uniform float uPaintAll;
uniform vec2 uShift;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uSunColor;
uniform vec4 uSun;
uniform float uInkScale;
uniform float uClouds;
uniform float uGlow;
uniform float uHorizonY;
uniform int uBirdCount;
uniform vec4 uBird[8];
uniform float uBirdAlpha;
uniform float uBirdDir;
uniform int uBirdLayer;
uniform float uMoon;
uniform float uSunGrow;
uniform float uDrop;

uint hashU(uvec2 p) {
  uint n = p.x * 1664525u ^ (p.y * 22695477u + 12345u);
  n ^= n >> 15u; n *= 2246822519u;
  n ^= n >> 13u; n *= 3266489917u;
  n ^= n >> 16u;
  return n;
}
float hash2(vec2 p) {
  ivec2 ip = ivec2(floor(p)) + 32768;
  return float(hashU(uvec2(ip))) / 4294967295.0;
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = m * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}
// three octaves, rescaled to the same range: enough for mist, brush texture and the brush edge
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = m * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v / 0.875 * 0.96875;
}

// A small brush-stroke bird: two wings rising from a dot, tips lifted or dropped by the flap.
float birdInk(vec2 uv, float aspect) {
  float ink = 0.0;
  for (int b = 0; b < 8; b++) {
    if (b >= uBirdCount) break;
    vec4 B = uBird[b];
    vec2 q = (uv - B.xy) * vec2(aspect, 1.0) / B.z;
    if (abs(q.x) > 1.25 || abs(q.y) > 1.25) continue;
    q.x *= uBirdDir;
    float ax = abs(q.x);
    float wingY = B.w * ax - 0.28 * ax * ax + 0.06;
    float thick = 0.11 * (1.0 - ax) + 0.03;
    float wing = (1.0 - smoothstep(thick, thick + 0.05, abs(q.y - wingY))) * (1.0 - smoothstep(0.95, 1.05, ax));
    float body = 1.0 - smoothstep(0.08, 0.13, length(vec2(q.x * 0.8 - 0.05, q.y * 1.4)));
    ink = max(ink, max(wing, body));
  }
  return ink * uBirdAlpha;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  vec3 col = uPaper;

  // sky: a faint wash deepening toward the top
  col = mix(col, uInk, 0.05 * smoothstep(0.45, 1.0, uv.y) * uInkScale);
  // the sun sits farther away than any ridge: it barely parallaxes, and sinks fastest on scroll
  vec2 sc = uSun.xy + uShift * 0.1 - vec2(0.0, uDrop * 2.2);
  float bloom = smoothstep(0.0, 0.2, uSunGrow);
  // warmth around the sun and a haze along the horizon
  if (uSun.w > 0.5 && uGlow > 0.0) {
    float ds = length((uv - sc) * vec2(aspect, 1.0));
    float halo = exp(-pow(ds / (uSun.z * 3.2), 2.0));
    float haze = exp(-pow((uv.y + uDrop - uHorizonY) / 0.12, 2.0));
    col = mix(col, uSunColor, uGlow * (mix(0.22, 0.12, uMoon) * halo + mix(0.06, 0.02, uMoon) * haze) * bloom);
  }
  // the sun, painted: a loaded brush leaves a wobbling edge, pigment pooled at the rim and
  // granulated inside; the moon is paler and mottled. A wisp of mist crosses its lower half.
  vec3 skyBack = col; // the sky without the sun: the far ridge paints over the sun, never through it
  if (uSun.w > 0.5) {
    vec2 dv = (uv - sc) * vec2(aspect, 1.0);
    float d = length(dv);
    float R = uSun.z * mix(0.15, 1.0, uSunGrow);
    if (d < R * 1.2) {
      vec2 dir = dv / max(d, 1e-5);
      float wob = (fbm3(dir * 1.6 + uSeed * 0.37) - 0.5) * mix(0.07, 0.025, uMoon) + (vnoise(dir * 11.0 + uSeed) - 0.5) * mix(0.03, 0.01, uMoon);
      float r = R * (1.0 + wob);
      float disc = 1.0 - smoothstep(r - R * 0.03, r + R * 0.02, d);
      vec2 lq = dv / R;
      float gran = fbm3(lq * 7.0 + uSeed * 1.3) - 0.5;
      float pool = smoothstep(0.6, 1.0, d / r);
      float wash = clamp(dot(lq, vec2(-0.6, 0.8)) * 0.5 + 0.5, 0.0, 1.0);
      float dens = 0.78 + 0.16 * pool - 0.12 * wash + 0.16 * gran;
      vec3 pig = uSunColor * (1.0 - 0.14 * pool * pool);
      if (uMoon > 0.5) {
        dens = 0.86 - 0.16 * smoothstep(0.45, 0.72, fbm3(lq * 1.9 + 3.0 + uSeed * 0.2)) + 0.06 * gran;
        pig = uSunColor;
      }
      col = mix(col, pig, clamp(disc * dens, 0.0, 1.0) * bloom);
    }
    if (uClouds > 0.0 && d < uSun.z * 3.2) {
      vec2 mq = dv / uSun.z;
      float streak = fbm3(vec2(mq.x * 0.55 + uTime * uDrift * 0.6 + uSeed * 0.7, mq.y * 2.6 + uSeed));
      float strip = exp(-pow((mq.y + 0.42) / 0.32, 2.0));
      float wisp = smoothstep(0.42, 0.72, streak) * strip * smoothstep(3.2, 1.4, length(mq)) * smoothstep(0.0, 0.5, uClouds);
      col = mix(col, uPaper, wisp * 0.8 * bloom);
    }
  }
  // a few long brush-streak clouds, drifting with the mist
  if (uClouds > 0.0) {
    vec2 cq = vec2(uv.x * aspect * 0.8 + uTime * uDrift * 0.15 + uSeed * 0.53, (uv.y + uDrop) * 11.0);
    float streak = smoothstep(0.5, 0.8, fbm3(cq));
    float inSky = smoothstep(uHorizonY - 0.02, uHorizonY + 0.2, uv.y + uDrop) * (1.0 - smoothstep(0.92, 1.0, uv.y));
    col = mix(col, uInk, uClouds * 0.26 * streak * inSky * uInkScale * smoothstep(0.0, 0.4, uPaintAll));
  }

  for (int i = 0; i < 5; i++) {
    if (i >= uLayers) break;
    vec4 L = uLayer[i];
    float fi = float(i);
    float depth = uLayers > 1 ? fi / float(uLayers - 1) : 1.0;
    vec2 p = uv + uShift * (0.25 + depth) + vec2(0.0, uDrop * (1.0 - depth));
    float x = p.x * aspect;
    float n = fbm(vec2(x * L.z + uSeed * 1.37 + fi * 7.31, fi * 3.7 + uSeed * 0.71));
    float ridged = 1.0 - abs(2.0 * vnoise(vec2(x * L.z * 2.3 + fi * 5.1 + uSeed, fi + uSeed * 0.3)) - 1.0);
    float h = L.x + L.y * ((n - 0.5) * 2.0 + (ridged - 0.5) * 0.35);

    float bleed = 0.0025 + 0.004 * vnoise(vec2(x * 40.0, fi * 9.0));
    float below = smoothstep(h + bleed, h - bleed, p.y);
    if (below > 0.0) { // above this ridge line: no ink from it, skip the expensive part
    if (i == 0) col = mix(col, skyBack, below);
    float fall = clamp((h - p.y) / (0.12 + 0.08 * depth), 0.0, 1.0);
    float tex = fbm3(vec2(x * 18.0, p.y * 22.0) + fi * 4.0 + uSeed);
    float dens = L.w * uInkScale * (1.0 - uMist * 0.95 * fall) * (0.82 + 0.36 * tex);
    float fog = smoothstep(0.42, 0.78, fbm3(vec2(x * 1.6 + uTime * uDrift * (0.4 + depth), p.y * 5.0 + fi * 2.0)));
    dens *= 1.0 - uMist * fog * fall * 0.9;

    // the crest: the brush presses hardest along the ridge line and skips where it runs dry
    float under = h - p.y;
    if (under < 0.03) {
      float crest = 1.0 - smoothstep(0.0, 0.004 + 0.01 * depth, under);
      float press = smoothstep(0.25, 0.7, vnoise(vec2(x * 9.0 + fi * 13.0, fi * 2.0 + uSeed)));
      dens += crest * crest * press * 0.45 * L.w * uInkScale;
    }

    float edge = mix(-0.2, 1.2, uPaint[i]) + (fbm3(vec2(p.y * 14.0, fi * 3.0 + uSeed)) - 0.5) * 0.18;
    float painted = 1.0 - smoothstep(edge - 0.035, edge + 0.035, uv.x);
    col = mix(col, uInk, clamp(below * dens * painted, 0.0, 1.0));
    }
    // the flock flies in front of the ridge it follows and behind the nearer ones
    if (i == uBirdLayer && uBirdCount > 0) col = mix(col, uInk, birdInk(uv, aspect) * 0.8 * uInkScale);
  }

  col += (hash2(uv * uResolution * 0.5) - 0.5) * uGrain * 0.1;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

const UNIFORMS = ['uResolution', 'uTime', 'uSeed', 'uMist', 'uDrift', 'uGrain', 'uLayers', 'uLayer', 'uPaint', 'uPaintAll', 'uShift', 'uPaper', 'uInk', 'uSunColor', 'uSun', 'uInkScale', 'uClouds', 'uGlow', 'uHorizonY', 'uBirdCount', 'uBird', 'uBirdAlpha', 'uBirdDir', 'uBirdLayer', 'uMoon', 'uSunGrow', 'uDrop'] as const

interface Frame {
  time: number
  seed: number
  mist: number
  drift: number
  grain: number
  layers: Layer[]
  paint: number[]
  paintAll: number
  shift: [number, number]
  paper: RGB
  ink: RGB
  sunColor: RGB
  sun: [number, number, number, number]
  /** Overall ink density: lighter ink on dark paper reads as moonlight, not glare. */
  inkScale: number
  clouds: number
  glow: number
  horizonY: number
  birds: Bird[]
  birdAlpha: number
  birdDir: number
  birdLayer: number
  moon: boolean
  sunGrow: number
  drop: number
}

/** One quad, one program, no textures; renders on demand. */
class RidgesGL {
  private canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private loc = new Map<string, WebGLUniformLocation | null>()
  private lost = false
  private onRestore: () => void
  ok = false

  constructor(canvas: HTMLCanvasElement, onRestore: () => void) {
    this.canvas = canvas
    this.onRestore = onRestore
    canvas.addEventListener('webglcontextlost', this.handleLost)
    canvas.addEventListener('webglcontextrestored', this.handleRestored)
    this.ok = this.init()
  }

  private handleLost = (e: Event) => {
    e.preventDefault() // required, or the browser never restores it
    this.lost = true
    this.ok = false
  }

  private handleRestored = () => {
    this.lost = false
    this.ok = this.init()
    if (this.ok) this.onRestore()
  }

  private init(): boolean {
    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' })
    if (!gl || gl.isContextLost()) return false
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh
      console.error('[ink-ridges] shader error', gl.getShaderInfoLog(sh))
      return null
    }
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return false
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[ink-ridges] link error', gl.getProgramInfoLog(program))
      return false
    }
    gl.useProgram(program)
    gl.bindVertexArray(gl.createVertexArray())
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    this.loc.clear()
    for (const name of UNIFORMS) this.loc.set(name, gl.getUniformLocation(program, name))
    this.gl = gl
    this.program = program
    return true
  }

  resize(w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  draw(f: Frame) {
    const gl = this.gl
    if (!gl || !this.program || !this.ok || this.lost) return
    const W = this.canvas.width
    const H = this.canvas.height
    gl.viewport(0, 0, W, H)
    const L = (n: string) => this.loc.get(n)!
    gl.uniform2f(L('uResolution'), W, H)
    gl.uniform1f(L('uTime'), f.time)
    gl.uniform1f(L('uSeed'), f.seed)
    gl.uniform1f(L('uMist'), f.mist)
    gl.uniform1f(L('uDrift'), f.drift)
    gl.uniform1f(L('uGrain'), f.grain)
    gl.uniform1i(L('uLayers'), f.layers.length)
    const layerData = new Float32Array(MAX_LAYERS * 4)
    const paintData = new Float32Array(MAX_LAYERS)
    f.layers.forEach((l, i) => {
      layerData.set([l.base, l.amp, l.freq, l.ink], i * 4)
      paintData[i] = f.paint[i] ?? 1
    })
    gl.uniform4fv(L('uLayer'), layerData)
    gl.uniform1fv(L('uPaint'), paintData)
    gl.uniform1f(L('uPaintAll'), f.paintAll)
    gl.uniform2f(L('uShift'), f.shift[0], f.shift[1])
    gl.uniform3f(L('uPaper'), ...f.paper)
    gl.uniform3f(L('uInk'), ...f.ink)
    gl.uniform3f(L('uSunColor'), ...f.sunColor)
    gl.uniform4f(L('uSun'), ...f.sun)
    gl.uniform1f(L('uInkScale'), f.inkScale)
    gl.uniform1f(L('uClouds'), f.clouds)
    gl.uniform1f(L('uGlow'), f.glow)
    gl.uniform1f(L('uHorizonY'), f.horizonY)
    const birdData = new Float32Array(8 * 4)
    f.birds.slice(0, 8).forEach((b, i) => birdData.set([b.x, b.y, b.size, b.flap], i * 4))
    gl.uniform1i(L('uBirdCount'), Math.min(8, f.birds.length))
    gl.uniform4fv(L('uBird'), birdData)
    gl.uniform1f(L('uBirdAlpha'), f.birdAlpha)
    gl.uniform1f(L('uBirdDir'), f.birdDir)
    gl.uniform1i(L('uBirdLayer'), f.birdLayer)
    gl.uniform1f(L('uMoon'), f.moon ? 1 : 0)
    gl.uniform1f(L('uSunGrow'), f.sunGrow)
    gl.uniform1f(L('uDrop'), f.drop)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.handleLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleRestored)
    if (this.gl && this.program && !this.lost) this.gl.deleteProgram(this.program)
    this.gl = null
    this.program = null
  }
}

/* ----------------------------- component -------------------------------- */

const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(' ')
const REDUCED = '(prefers-reduced-motion: reduce)'

export interface InkRidgesProps {
  /** Number of ridges, 1–5. */
  layers?: number
  /** Any number; each one paints a different range. */
  seed?: number
  /** Height of the farthest ridge, 0.3–0.82 of the frame. */
  horizon?: number
  /** How much mist lifts out of each foot, 0–1. */
  mist?: number
  /** Mist drift speed; 0 keeps it still (and lets the landscape stop drawing). */
  drift?: number
  /** Pointer parallax strength; 0 turns it off. */
  parallax?: number
  /** Brush-in time in ms; 0 shows the landscape already painted. */
  paintIn?: number
  /** Draw a sun disc behind the far ridge. */
  sun?: boolean
  /** Sun center in the frame, x left→right and y bottom→top, 0–1. */
  sunPosition?: [number, number]
  /** Sun radius as a fraction of the frame height. */
  sunSize?: number
  /** CSS color of the sun. Defaults to vermilion, the red of a painter's seal. The moon is always painted in the ink color. */
  sunColor?: string
  /** Paint a pale, mottled moon instead of the sun: always, never, or 'auto' (on dark paper). */
  moon?: boolean | 'auto'
  /** Scroll depth: as the frame scrolls up out of view, far ridges lag and the sun sets. 0 turns it off. */
  scrollDepth?: number
  /** CSS color of the ink. Defaults to the text color. */
  inkColor?: string
  /** Paper grain, 0–1. */
  grain?: number
  /** Brush-streak clouds in the sky, 0–1. */
  clouds?: number
  /** Warm halo around the sun and haze along the horizon, 0–1 (needs the sun). */
  glow?: number
  /** Birds in each passing flock, 0–8; 0 means none. */
  birds?: number
  /** Average seconds between flocks (each gap varies ±40%). */
  birdsEvery?: number
  /** Device-pixel-ratio cap for the canvas. */
  dprCap?: number
  /** An accessible description; without it the landscape is treated as decoration. */
  label?: string
  className?: string
  /** Content laid over the landscape. */
  children?: React.ReactNode
}

export default function InkRidges({
  layers = 4,
  seed = 7,
  horizon = 0.62,
  mist = 0.6,
  drift = 0.05,
  parallax = 0.03,
  paintIn = 2400,
  sun = true,
  sunPosition = [0.78, 0.74],
  sunSize = 0.07,
  sunColor = '#b5402a',
  moon = 'auto',
  scrollDepth = 0.35,
  inkColor,
  grain = 0.3,
  clouds = 0.35,
  glow = 0.45,
  birds = 5,
  birdsEvery = 14,
  dprCap = 1.5,
  label,
  className,
  children,
}: InkRidgesProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [glOk, setGlOk] = React.useState(true)
  const opts = React.useRef({ layers, horizon, mist, drift, parallax, paintIn, sun, sunPosition, sunSize, sunColor, moon, scrollDepth, inkColor, grain, seed, clouds, glow, birds, birdsEvery })
  opts.current = { layers, horizon, mist, drift, parallax, paintIn, sun, sunPosition, sunSize, sunColor, moon, scrollDepth, inkColor, grain, seed, clouds, glow, birds, birdsEvery }
  const ctl = React.useRef({ kick: () => {}, repaint: () => {}, retheme: () => {} })

  React.useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const reducedMq = window.matchMedia(REDUCED)
    let raf = 0
    let last = 0
    let time = 0
    let visible = true
    let paintStart = performance.now()
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 }
    let flight: Flight | null = null
    let nextFlightAt = Infinity
    let flightTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleFlight = (from: number, first: boolean) => {
      const o = opts.current
      if (o.birds <= 0 || reducedMq.matches) {
        nextFlightAt = Infinity
        return
      }
      const every = Math.max(1, o.birdsEvery) * 1000
      nextFlightAt = from + (first ? Math.min(every, Math.max(0, o.paintIn) + 1500) : every * (0.6 + 0.8 * Math.random()))
    }
    scheduleFlight(paintStart, true)
    let paper: RGB = [1, 1, 1]
    let inkRgb: RGB = [0.1, 0.1, 0.1]
    let sunRgb: RGB = [0.1, 0.1, 0.1]
    let night = false

    const theme = () => {
      const o = opts.current
      paper = resolveColor(root, 'backgroundColor')
      inkRgb = (o.inkColor && resolveCssColor(o.inkColor)) || resolveColor(root, 'color')
      night = moonFor(o.moon, paper)
      sunRgb = (!night && o.sunColor && resolveCssColor(o.sunColor)) || inkRgb
    }

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const gl = new RidgesGL(canvas, kick)
    if (!gl.ok) {
      setGlOk(false)
      root.style.setProperty('--ink-ridges-paint', '1')
      return () => gl.dispose()
    }
    theme()

    function frame(now: number) {
      raf = 0
      const o = opts.current
      const reduced = reducedMq.matches
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      const p = reduced || o.paintIn <= 0 ? 1 : clamp01((now - paintStart) / o.paintIn)
      if (reduced) {
        ptr.x = ptr.y = ptr.tx = ptr.ty = 0
      } else {
        time += dt
        ptr.x = damp(ptr.x, ptr.tx, 6, dt)
        ptr.y = damp(ptr.y, ptr.ty, 6, dt)
      }
      const n = Math.max(1, Math.min(MAX_LAYERS, Math.round(o.layers)))
      const ridges = Array.from({ length: n }, (_, i) => layerAt(i, n, o.horizon))
      const aspect = canvas!.width / Math.max(1, canvas!.height)
      const drop = reduced || o.scrollDepth <= 0 ? 0 : scrollDrop(-root!.getBoundingClientRect().top, root!.clientHeight, o.scrollDepth)
      const ridgeOpts: RidgeOpts = { n, horizon: o.horizon, seed: o.seed, aspect, shift: [ptr.x, ptr.y], drop }
      // a flock: start one when it is due (never while hidden, painting or under reduced motion), end it when it has crossed
      if (!flight && !reduced && visible && p >= 1 && o.birds > 0 && now >= nextFlightAt) {
        flight = { start: now, duration: 9 + Math.random() * 3, dir: Math.random() < 0.5 ? 1 : -1, count: Math.min(8, Math.round(o.birds)), layer: n >= 3 ? 1 : 0, seed: Math.floor(Math.random() * 1000) }
      }
      let flock: { alpha: number; birds: Bird[] } = { alpha: 0, birds: [] }
      let flightU = 0
      if (flight) {
        const t = (now - flight.start) / 1000
        if (t >= flight.duration || reduced || o.birds <= 0) {
          flight = null
          scheduleFlight(now, false)
        } else {
          flock = birdsAt(flight, t, ridgeOpts)
          flightU = t / flight.duration
        }
      }
      gl.draw({
        time,
        seed: o.seed,
        mist: clamp01(o.mist),
        drift: reduced ? 0 : Math.max(0, o.drift),
        grain: o.grain,
        layers: ridges,
        paint: ridges.map((_, i) => ink(paintAt(p, i, n))),
        paintAll: p,
        shift: [ptr.x, ptr.y],
        paper,
        ink: inkRgb,
        sunColor: sunRgb,
        sun: [o.sunPosition[0], o.sunPosition[1], o.sunSize, o.sun ? 1 : 0],
        inkScale: inkScaleFor(paper),
        clouds: clamp01(o.clouds),
        glow: clamp01(o.glow),
        horizonY: layerAt(0, n, o.horizon).base,
        birds: flock.birds,
        birdAlpha: flock.alpha,
        birdDir: flight?.dir ?? 1,
        birdLayer: flight ? flight.layer : -1,
        moon: night,
        sunGrow: sunBloom(p),
        drop,
      })
      root!.style.setProperty('--ink-ridges-paint', String(p))
      root!.style.setProperty('--ink-ridges-flight', String(flightU))
      const settling = Math.abs(ptr.x - ptr.tx) > 1e-4 || Math.abs(ptr.y - ptr.ty) > 1e-4
      const moving = p < 1 || o.drift > 0 || settling || !!flight
      clearTimeout(flightTimer)
      if (!reduced && visible && !document.hidden && moving) raf = requestAnimationFrame(frame)
      else {
        last = 0 // the next start takes no time jump
        // idle between flocks: wake once, when the next one is due
        if (!reduced && visible && !document.hidden && Number.isFinite(nextFlightAt)) {
          flightTimer = setTimeout(kick, Math.max(0, nextFlightAt - performance.now()) + 16)
        }
      }
    }

    const resize = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect
      if (!r) return
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
      gl.resize(Math.max(1, Math.round(r.width * dpr)), Math.max(1, Math.round(r.height * dpr)))
      kick()
    })
    resize.observe(root)

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting
      if (visible) kick()
    })
    io.observe(root)

    const onPointer = (e: PointerEvent) => {
      const o = opts.current
      if (reducedMq.matches || o.parallax <= 0 || e.pointerType === 'touch') return
      const r = root.getBoundingClientRect()
      ptr.tx = ((e.clientX - r.left) / r.width - 0.5) * o.parallax
      ptr.ty = -((e.clientY - r.top) / r.height - 0.5) * o.parallax
      kick()
    }
    const onLeave = () => {
      ptr.tx = 0
      ptr.ty = 0
      kick()
    }
    root.addEventListener('pointermove', onPointer)
    root.addEventListener('pointerleave', onLeave)

    // scroll depth: redraw on scroll while the frame is on screen
    const onScroll = () => {
      if (visible && opts.current.scrollDepth > 0 && !reducedMq.matches) kick()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const onVisibility = () => kick()
    document.addEventListener('visibilitychange', onVisibility)
    reducedMq.addEventListener('change', onVisibility)
    const onTheme = () => {
      theme()
      kick()
    }
    const mo = new MutationObserver(onTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', onTheme)

    ctl.current = {
      kick,
      repaint: () => {
        paintStart = performance.now()
        flight = null
        scheduleFlight(paintStart, true)
        kick()
      },
      retheme: onTheme,
    }
    kick()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      clearTimeout(flightTimer)
      ctl.current = { kick: () => {}, repaint: () => {}, retheme: () => {} }
      resize.disconnect()
      io.disconnect()
      mo.disconnect()
      root.removeEventListener('pointermove', onPointer)
      root.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMq.removeEventListener('change', onVisibility)
      scheme.removeEventListener('change', onTheme)
      gl.dispose()
    }
  }, [dprCap])

  // a new seed paints a new range from the start
  const firstSeed = React.useRef(true)
  React.useEffect(() => {
    if (firstSeed.current) {
      firstSeed.current = false
      return
    }
    ctl.current.repaint()
  }, [seed])

  // any other change redraws once (and keeps drawing only if something now moves)
  React.useEffect(() => {
    ctl.current.kick()
  }, [layers, horizon, mist, drift, parallax, sun, sunPosition, sunSize, grain, clouds, glow, birds, birdsEvery, scrollDepth])
  React.useEffect(() => {
    ctl.current.retheme()
  }, [inkColor, sunColor, moon])

  return (
    <div ref={rootRef} data-ink-ridges="" className={cn('relative isolate overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn('absolute inset-0 block h-full w-full', !glOk && 'hidden')}
      />
      {!glOk ? (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 45%, color-mix(in oklab, currentColor 16%, transparent))' }}
        />
      ) : null}
      {children ? <div className="relative z-10 h-full">{children}</div> : null}
    </div>
  )
}
