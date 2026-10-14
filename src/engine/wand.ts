// Wand assembly: a form (twig ... archwand) plus hilt, shaft and tip -> derived wand stats.
// See docs/DESIGN.md "Wand forms" and "What each part does".
//
// Part roles:
//   hilt  - where charge comes from (draw sources), capacity, recharge, the wielder's side
//   shaft - sockets, flanks, conductivity, stability, element harmony; most material quirks
//   tip   - potency, speed, bite (what the shot hits hardest), how the shot leaves the wand
import { DRAW_SOURCES, FAMILIES, FormId, Material, PartEffect, WandForm, Zone, form as formDef, material } from './data';

export interface CrystalSlot {
  id: string;
  quality: string; // chipped | clear | bright | flawless
}

export interface WandBuild {
  form: FormId;
  /** null = no hilt fitted (a twig never has one). */
  hilt: string | null;
  shaft: string;
  /** null = no tip fitted (a twig and a plain wand never have one). */
  tip: string | null;
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
  /** Total sockets: hilt + shaft + tip. */
  sockets: number;
  /** Sockets in each zone. The spine lists hilt sockets first, then shaft, then tip. */
  zoneSockets: Record<Zone, number>;
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
  parts: { hilt: Material | null; shaft: Material; tip: Material | null };
  hiltEffect: PartEffect;
  shaftEffect: PartEffect;
  tipEffect: PartEffect;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const vel = (m: Material) => m.velocity ?? FAMILIES[m.family].velocity;
const tem = (m: Material) => m.tempo ?? FAMILIES[m.family].tempo;

/** Which parts a form can hold, with missing parts dropped. */
export function fittedParts(build: Pick<WandBuild, 'form' | 'hilt' | 'shaft' | 'tip'>) {
  const f = formDef(build.form);
  const hilt = f.parts.includes('hilt') && build.hilt ? material(build.hilt) : null;
  const tip = f.parts.includes('tip') && build.tip ? material(build.tip) : null;
  return { f, hilt, shaft: material(build.shaft), tip };
}

/** Blend a stat across parts. A missing part's weight falls to the shaft. */
function blend(weights: { hilt: number; shaft: number; tip: number }, parts: { hilt: Material | null; shaft: Material; tip: Material | null }, key: 'P' | 'C' | 'R' | 'S' | 'Cn') {
  let total = parts.shaft[key] * weights.shaft;
  total += parts.hilt ? parts.hilt[key] * weights.hilt : parts.shaft[key] * weights.hilt;
  total += parts.tip ? parts.tip[key] * weights.tip : parts.shaft[key] * weights.tip;
  return total;
}

export function wandStats(build: Pick<WandBuild, 'form' | 'hilt' | 'shaft' | 'tip'>): WandStats {
  const { f, hilt, shaft, tip } = fittedParts(build);
  const parts = { hilt, shaft, tip };
  const hiltEffect = hilt?.hilt.effect ?? {};
  const shaftEffect = shaft.shaft.effect ?? {};
  const tipEffect = tip?.tip.effect ?? {};

  const potency = round1(blend({ tip: 0.5, shaft: 0.3, hilt: 0.2 }, parts, 'P'));
  const capacity = round1(blend({ hilt: 0.5, shaft: 0.3, tip: 0.2 }, parts, 'C') * (hiltEffect.capacity ?? 1));
  const recharge = round1(blend({ hilt: 0.5, shaft: 0.3, tip: 0.2 }, parts, 'R'));
  const stability = round1(blend({ shaft: 0.5, hilt: 0.25, tip: 0.25 }, parts, 'S'));
  const conductivity = round1(blend({ shaft: 0.6, hilt: 0.2, tip: 0.2 }, parts, 'Cn'));
  let velocity = tip ? 0.6 * vel(tip) + 0.4 * vel(shaft) : vel(shaft);
  velocity *= tipEffect.speed ?? 1;
  if (tipEffect.heavy) velocity *= 0.8;
  const tempo = round1((hilt ? 0.5 * tem(hilt) + 0.5 * tem(shaft) : tem(shaft)) * (shaftEffect.tempo ?? 1) * f.tempoMult);

  const zoneSockets: Record<Zone, number> = {
    hilt: hilt ? f.hiltSockets : 0,
    shaft: Math.min(shaft.sockets + f.shaftBonus, f.shaftMax),
    tip: tip ? f.tipSockets : 0,
  };
  const sockets = zoneSockets.hilt + zoneSockets.shaft + zoneSockets.tip;
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
    bite: { ...(tip?.bite ?? {}) },
    sockets,
    zoneSockets,
    maxFlanks,
    heatLimit: Math.round(stability) + 2 + (shaftEffect.heatLimit ?? 0),
    maxCharge: Math.round(capacity * 10),
    chargePerSecond: round1(recharge * 2),
    baseDrain: 4,
    basePower: round1(potency * 3),
    fadePerStep: Math.max(0.1, 1 - (10 - conductivity) * 0.05),
    drawMix: hilt ? { ...hilt.drawMix } : { wielder: 1 },
    parts,
    hiltEffect,
    shaftEffect,
    tipEffect,
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

/** Which zone a socket (by spine index) sits in. */
export function zoneOf(stats: Pick<WandStats, 'zoneSockets'>, index: number): Zone {
  const z = stats.zoneSockets;
  if (index < z.hilt) return 'hilt';
  if (index < z.hilt + z.shaft) return 'shaft';
  return 'tip';
}

/** Spine index range [start, end) of a zone. */
export function zoneRange(stats: Pick<WandStats, 'zoneSockets'>, zone: Zone): [number, number] {
  const z = stats.zoneSockets;
  if (zone === 'hilt') return [0, z.hilt];
  if (zone === 'shaft') return [z.hilt, z.hilt + z.shaft];
  return [z.hilt + z.shaft, z.hilt + z.shaft + z.tip];
}

/** An empty wand of the given form and parts, sized to its sockets. */
export function emptyBuild(formId: FormId, hilt: string | null, shaft: string, tip: string | null): WandBuild {
  const b: WandBuild = { form: formId, hilt, shaft, tip, spine: [], flanks: {} };
  b.spine = Array(wandStats(b).sockets).fill(null);
  return b;
}

/**
 * Fit a build to its (possibly new) form and parts: drop parts the form can't hold and resize
 * the zones. When the previous build is given, crystals stay in their zone where they can
 * (a hilt crystal stays in the hilt); crystals with no room left move to any free socket,
 * and only then are they dropped.
 */
export function refit(build: WandBuild, prev?: WandBuild): WandBuild {
  const f = formDef(build.form);
  const b: WandBuild = {
    ...build,
    hilt: f.parts.includes('hilt') ? build.hilt : null,
    tip: f.parts.includes('tip') ? build.tip : null,
  };
  const st = wandStats(b);
  const spine: WandBuild['spine'] = Array(st.sockets).fill(null);
  if (prev) {
    const pst = wandStats(prev);
    const overflow: WandBuild['spine'] = [];
    for (const zone of ['hilt', 'shaft', 'tip'] as Zone[]) {
      const [ps, pe] = zoneRange(pst, zone);
      const [ns, ne] = zoneRange(st, zone);
      const items = build.spine.slice(ps, pe);
      items.forEach((c, k) => {
        if (!c) return;
        if (ns + k < ne) spine[ns + k] = c;
        else overflow.push(c);
      });
    }
    for (const c of overflow) {
      const free = spine.findIndex((x) => x === null);
      if (free >= 0) spine[free] = c;
    }
  } else {
    for (let i = 0; i < st.sockets; i++) spine[i] = build.spine[i] ?? null;
  }
  b.spine = spine;
  const flanks: WandBuild['flanks'] = {};
  Object.entries(build.flanks)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([g]) => g < st.sockets - 1)
    .slice(0, st.maxFlanks)
    .forEach(([g, v]) => (flanks[g] = v));
  b.flanks = flanks;
  return b;
}
