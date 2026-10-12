// Heat meter and overload rolls (docs/DESIGN.md "Heat and overload").
// The wand keeps a running Heat total: each shot adds its Heat, and Heat cools over time.
// Going over the limit rolls on the overload table.

export type OverloadKind = 'fizzle' | 'backlash' | 'crack' | 'surge' | 'fireBurst';

export interface Overload {
  kind: OverloadKind;
  title: string;
  text: string;
  /** Multiplier on the shot's power (0 = the shot fails). */
  powerMult: number;
  /** Fraction of the shot's power that hits the wielder. */
  backlash: number;
  /** Permanent Stability lost until repaired. */
  stabilityLoss: number;
}

/** Heat lost per second. */
export const HEAT_COOLING_PER_SECOND = 6;

/** Deterministic RNG so tests and replays are repeatable. */
export function makeRng(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Roll the overload table. The further over the limit, the likelier the bad (and wild) results.
 * Emberpine turns fizzles and backlashes into fire bursts; Amethyst halves backlash.
 */
export function rollOverload(excess: number, rng: () => number, shaftId: string): Overload {
  const push = Math.min(0.25, excess * 0.03);
  const r = rng();
  // base odds: fizzle 45%, backlash 25%, crack 15%, surge 15%; excess shifts odds from fizzle toward crack and surge
  const pFizzle = 0.45 - 2 * push;
  const pBacklash = 0.25;
  const pCrack = 0.15 + push;
  let kind: OverloadKind;
  if (r < pFizzle) kind = 'fizzle';
  else if (r < pFizzle + pBacklash) kind = 'backlash';
  else if (r < pFizzle + pBacklash + pCrack) kind = 'crack';
  else kind = 'surge';

  if (shaftId === 'emberpine' && (kind === 'fizzle' || kind === 'backlash')) kind = 'fireBurst';
  const amethyst = shaftId === 'amethyst' ? 0.5 : 1;

  switch (kind) {
    case 'fizzle':
      return { kind, title: 'Fizzle', text: 'The shot fails; charge is lost.', powerMult: 0, backlash: 0, stabilityLoss: 0 };
    case 'backlash':
      return { kind, title: 'Backlash', text: "The shot's element hits you.", powerMult: 1, backlash: 0.25 * amethyst, stabilityLoss: 0 };
    case 'crack':
      return { kind, title: 'Crack', text: 'The wand loses 1 Stability until repaired.', powerMult: 1, backlash: 0, stabilityLoss: 1 };
    case 'surge':
      return { kind, title: 'Wild surge!', text: 'Triple power and a random extra element.', powerMult: 3, backlash: 0, stabilityLoss: 0 };
    case 'fireBurst':
      return { kind, title: 'Resin flare', text: 'Emberpine resin ignites: a burst of fire around you.', powerMult: 1, backlash: 0, stabilityLoss: 0 };
  }
}
