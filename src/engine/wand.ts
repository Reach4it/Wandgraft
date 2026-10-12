// Wand assembly: grip + shaft + cap -> derived wand stats.
// See docs/DESIGN.md "Core premise" (grafting) and "Base wand stats".
import { FAMILIES, Material, material } from './data';

export interface CrystalSlot {
  id: string;
  quality: string; // chipped | clear | bright | flawless
}

export interface WandBuild {
  grip: string;
  shaft: string;
  cap: string;
  /** Spine sockets, handle -> tip. null = empty socket. */
  spine: (CrystalSlot | null)[];
  /** Flank sockets by gap index (0 = between S1 and S2). */
  flanks: Record<number, CrystalSlot>;
}

export interface WandStats {
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
  /** Charge refilled per second. */
  chargePerSecond: number;
  /** Charge every shot costs before crystals. */
  baseDrain: number;
  /** Power of a bare shot before crystals. */
  basePower: number;
  /** Fraction of a boost kept per socket it travels toward the tip. */
  fadePerStep: number;
  parts: { grip: Material; shaft: Material; cap: Material };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Weighted blend: each stat leans on the part that matters most for it. */
export function wandStats(build: Pick<WandBuild, 'grip' | 'shaft' | 'cap'>): WandStats {
  const grip = material(build.grip);
  const shaft = material(build.shaft);
  const cap = material(build.cap);
  const vel = (m: Material) => m.velocity ?? FAMILIES[m.family].velocity;
  const tem = (m: Material) => m.tempo ?? FAMILIES[m.family].tempo;

  const potency = round1(0.5 * cap.P + 0.3 * shaft.P + 0.2 * grip.P);
  const capacity = round1(0.5 * grip.C + 0.3 * shaft.C + 0.2 * cap.C);
  const recharge = round1(0.5 * grip.R + 0.3 * shaft.R + 0.2 * cap.R);
  const stability = round1(0.5 * shaft.S + 0.25 * grip.S + 0.25 * cap.S);
  const conductivity = round1(0.6 * shaft.Cn + 0.2 * grip.Cn + 0.2 * cap.Cn);
  const velocity = round1(0.6 * vel(cap) + 0.4 * vel(shaft));
  const tempo = round1(0.5 * tem(grip) + 0.5 * tem(shaft));

  const maxFlanks = shaft.flankChance > 0 ? Math.ceil(shaft.flankChance * (shaft.sockets - 1) * 2) : 0;

  return {
    potency,
    capacity,
    recharge,
    stability,
    conductivity,
    velocity,
    tempo,
    bite: { ...cap.bite },
    sockets: shaft.sockets,
    maxFlanks,
    heatLimit: Math.round(stability) + 2,
    maxCharge: Math.round(capacity * 10),
    chargePerSecond: round1(recharge * 2),
    baseDrain: 4,
    basePower: round1(potency * 3),
    fadePerStep: Math.max(0.1, 1 - (10 - conductivity) * 0.05),
    parts: { grip, shaft, cap },
  };
}

/** An empty wand of the given parts, sized to the shaft's sockets. */
export function emptyBuild(grip: string, shaft: string, cap: string): WandBuild {
  return { grip, shaft, cap, spine: Array(material(shaft).sockets).fill(null), flanks: {} };
}
