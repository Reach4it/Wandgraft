// Wand assembly: a form (twig ... staff) plus grip, shaft and cap -> derived wand stats.
// See docs/DESIGN.md "Wand forms" and "What each part does".
//
// Part roles:
//   grip  - where charge comes from (draw sources), capacity, recharge, the wielder's side
//   shaft - sockets, flanks, conductivity, stability, element harmony; most material quirks
//   cap   - potency, speed, bite (what the shot hits hardest), how the shot leaves the wand
import { DRAW_SOURCES, FAMILIES, FormId, Material, PartEffect, WandForm, form as formDef, material } from './data';

export interface CrystalSlot {
  id: string;
  quality: string; // chipped | clear | bright | flawless
}

export interface WandBuild {
  form: FormId;
  /** null = no grip fitted (a twig never has one). */
  grip: string | null;
  shaft: string;
  /** null = no cap fitted (a twig and a plain wand never have one). */
  cap: string | null;
  /** Spine sockets, handle -> tip. null = empty socket. */
  spine: (CrystalSlot | null)[];
  /** Flank sockets by gap index (0 = between S1 and S2). */
  flanks: Record<number, CrystalSlot>;
}

export interface Env {
  time: 'day' | 'night';
  weather: 'clear' | 'rain' | 'storm';
}

export const DEFAULT_ENV: Env = { time: 'day', weather: 'clear' };

export interface WandStats {
  form: WandForm;
  potency: number;
  capacity: number;
  recharge: number;
  stability: number;
  conductivity: number;
  velocity: number;
  tempo: number;
  bite: Record<string, number>;
  sockets: number;
  maxFlanks: number;
  /** Heat the wand tolerates before overloading. */
  heatLimit: number;
  /** Charge reservoir size. */
  maxCharge: number;
  /** Charge refilled per second before draw-source conditions. */
  chargePerSecond: number;
  /** Charge every shot costs before crystals. */
  baseDrain: number;
  /** Power of a bare shot before crystals. */
  basePower: number;
  /** Fraction of a boost kept per socket it travels toward the tip. */
  fadePerStep: number;
  /** Where recharge comes from, as shares that sum to 1. */
  drawMix: Record<string, number>;
  parts: { grip: Material | null; shaft: Material; cap: Material | null };
  gripEffect: PartEffect;
  shaftEffect: PartEffect;
  capEffect: PartEffect;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const vel = (m: Material) => m.velocity ?? FAMILIES[m.family].velocity;
const tem = (m: Material) => m.tempo ?? FAMILIES[m.family].tempo;

/** Which parts a form can hold, with missing parts dropped. */
export function fittedParts(build: Pick<WandBuild, 'form' | 'grip' | 'shaft' | 'cap'>) {
  const f = formDef(build.form);
  const grip = f.parts.includes('grip') && build.grip ? material(build.grip) : null;
  const cap = f.parts.includes('cap') && build.cap ? material(build.cap) : null;
  return { f, grip, shaft: material(build.shaft), cap };
}

/** Blend a stat across parts. A missing part's weight falls to the shaft. */
function blend(weights: { grip: number; shaft: number; cap: number }, parts: { grip: Material | null; shaft: Material; cap: Material | null }, key: 'P' | 'C' | 'R' | 'S' | 'Cn') {
  let total = parts.shaft[key] * weights.shaft;
  total += parts.grip ? parts.grip[key] * weights.grip : parts.shaft[key] * weights.grip;
  total += parts.cap ? parts.cap[key] * weights.cap : parts.shaft[key] * weights.cap;
  return total;
}

export function wandStats(build: Pick<WandBuild, 'form' | 'grip' | 'shaft' | 'cap'>): WandStats {
  const { f, grip, shaft, cap } = fittedParts(build);
  const parts = { grip, shaft, cap };
  const gripEffect = grip?.grip.effect ?? {};
  const shaftEffect = shaft.shaft.effect ?? {};
  const capEffect = cap?.cap.effect ?? {};

  const potency = round1(blend({ cap: 0.5, shaft: 0.3, grip: 0.2 }, parts, 'P'));
  const capacity = round1(blend({ grip: 0.5, shaft: 0.3, cap: 0.2 }, parts, 'C') * (gripEffect.capacity ?? 1));
  const recharge = round1(blend({ grip: 0.5, shaft: 0.3, cap: 0.2 }, parts, 'R'));
  const stability = round1(blend({ shaft: 0.5, grip: 0.25, cap: 0.25 }, parts, 'S'));
  const conductivity = round1(blend({ shaft: 0.6, grip: 0.2, cap: 0.2 }, parts, 'Cn'));
  let velocity = cap ? 0.6 * vel(cap) + 0.4 * vel(shaft) : vel(shaft);
  velocity *= capEffect.speed ?? 1;
  if (capEffect.heavy) velocity *= 0.8;
  const tempo = round1((grip ? 0.5 * tem(grip) + 0.5 * tem(shaft) : tem(shaft)) * (shaftEffect.tempo ?? 1) * f.tempoMult);

  const sockets = Math.min(shaft.sockets + f.socketBonus, f.maxSockets);
  const naturalFlanks = shaft.flankChance > 0 ? Math.ceil(shaft.flankChance * (sockets - 1) * 2) : 0;
  const maxFlanks = f.flanks === 'none' ? 0 : f.flanks === 'one' ? Math.min(1, naturalFlanks) : naturalFlanks;

  return {
    form: f,
    potency,
    capacity,
    recharge,
    stability,
    conductivity,
    velocity: round1(velocity),
    tempo,
    bite: { ...(cap?.bite ?? {}) },
    sockets,
    maxFlanks,
    heatLimit: Math.round(stability) + 2 + (shaftEffect.heatLimit ?? 0),
    maxCharge: Math.round(capacity * 10),
    chargePerSecond: round1(recharge * 2),
    baseDrain: 4,
    basePower: round1(potency * 3),
    fadePerStep: Math.max(0.1, 1 - (10 - conductivity) * 0.05),
    drawMix: grip ? { ...grip.drawMix } : { wielder: 1 },
    parts,
    gripEffect,
    shaftEffect,
    capEffect,
  };
}

/** How well each draw source flows under the current conditions (1 = normal). */
export function sourceAvailability(source: string, env: Env, moving: boolean): number {
  const rainy = env.weather !== 'clear';
  switch (source) {
    case 'wielder': return 1;
    case 'water': return rainy ? 1.5 : 0.5;
    case 'seawater': return 0.3;
    case 'moon': return env.time === 'night' ? 1.5 : 0.2;
    case 'sky': return env.time === 'night' ? 1.6 : 0.1;
    case 'sun': return env.time === 'night' ? 0 : env.weather === 'clear' ? 1.5 : env.weather === 'rain' ? 0.6 : 0.3;
    case 'ground': return 1;
    case 'still': return moving ? 0 : 1.5;
    case 'calm': return moving ? 0.2 : 1.3;
    case 'motion': return moving ? 1.6 : 0.2;
    case 'kills': return 0.3;
    case 'fire': return 0.4;
    case 'storm': return env.weather === 'storm' ? 2 : env.weather === 'rain' ? 0.8 : 0.3;
    case 'wind': return env.weather === 'storm' ? 1.6 : env.weather === 'rain' ? 1 : 0.7;
    case 'allies': return 0;
    case 'cold': return (env.time === 'night' ? 1 : 0.5) * (rainy ? 1.2 : 1);
    case 'blood': return 1.8;
    case 'growth': return rainy ? 1.3 : 0.8;
    case 'sleep': return 0.3;
    default: return 1;
  }
}

export interface DrawReport {
  /** Total recharge multiplier from draw sources right now. */
  mult: number;
  parts: { source: string; name: string; share: number; availability: number }[];
}

export function drawReport(stats: WandStats, env: Env, moving: boolean): DrawReport {
  const parts = Object.entries(stats.drawMix).map(([source, share]) => ({
    source,
    name: DRAW_SOURCES[source] ?? source,
    share,
    availability: sourceAvailability(source, env, moving),
  }));
  const mult = parts.reduce((s, p) => s + p.share * p.availability, 0);
  return { mult, parts };
}

/** An empty wand of the given form and parts, sized to its sockets. */
export function emptyBuild(formId: FormId, grip: string | null, shaft: string, cap: string | null): WandBuild {
  const b: WandBuild = { form: formId, grip, shaft, cap, spine: [], flanks: {} };
  b.spine = Array(wandStats(b).sockets).fill(null);
  return b;
}

/** Fit a build to a (possibly new) form or shaft: drop parts the form can't hold, resize sockets and flanks. */
export function refit(build: WandBuild): WandBuild {
  const f = formDef(build.form);
  const b: WandBuild = {
    ...build,
    grip: f.parts.includes('grip') ? build.grip : null,
    cap: f.parts.includes('cap') ? build.cap : null,
  };
  const st = wandStats(b);
  b.spine = Array.from({ length: st.sockets }, (_, i) => build.spine[i] ?? null);
  const flanks: WandBuild['flanks'] = {};
  Object.entries(build.flanks)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([g]) => g < st.sockets - 1)
    .slice(0, st.maxFlanks)
    .forEach(([g, v]) => (flanks[g] = v));
  b.flanks = flanks;
  return b;
}
