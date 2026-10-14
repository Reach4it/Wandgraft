// Shot resolution: the 7 steps from docs/DESIGN.md "Synergy engine".
//   1 Draw   2 Seed   3 Halo pass   4 Forward pass   5 Feedback   6 Heat   7 Release
// Pure logic: no rendering, no randomness (overload rolls live in overload.ts),
// so the same build always resolves to the same shot.
import {
  Crystal,
  ELEMENTS,
  PartEffect,
  Material,
  Zone,
  ElementId,
  REACTIONS,
  Reaction,
  SECOND_ORDER,
  crystal as crystalDef,
  quality as qualityDef,
} from './data';
import { CrystalSlot, DEFAULT_ENV, Env, WandBuild, WandStats, wandStats, zoneOf } from './wand';

export type Form = 'bolt' | 'stream' | 'shard' | 'gust' | 'lob' | 'arcane';

export interface Shot {
  /** Projectiles fired at once. */
  count: number;
  /** Power of each projectile. */
  powerEach: number;
  /** Extra weak side copies (Prismglass). */
  sideCopies: number;
  sideCopyPower: number;
  /** Element tags the shot carries (drives damage vs. targets). */
  tags: ElementId[];
  /** Final fused reaction, if any. */
  reaction: Reaction | null;
  /** Every reaction that happened along the chain, in order. */
  reactions: Reaction[];
  form: Form;
  color: string;
  speed: number;
  size: number;
  spreadDeg: number;
  pierce: number;
  bounces: number;
  homing: boolean;
  aoeRadius: number;
  lingerSeconds: number;
  echoes: number;
  seeds: number;
  critChance: number;
  siphon: number;
  rechargeMult: number;
  /** On-hit effects: burn, soak, blind, root, chain, ... */
  effects: string[];
  /** Material clash byproducts (steam mist, erosion, dust, howl). */
  byproducts: string[];
  /** Feedback loops that ran. */
  loops: number;
  drain: number;
  heat: number;
  /** Extra chain jumps (Copper or Fulgurite tip). */
  chainBonus: number;
  /** Tip pulls shots toward armored targets (Lodestone). */
  magnet: boolean;
  /** Hits mark targets; later shots curve toward marks (Chalk). */
  mark: boolean;
  /** Shots curve gently toward the aim point (Willow tip). */
  steer: boolean;
  /** Every Nth shot fires twice (Amber tip); 0 = off. */
  replayEvery: number;
  /** Multiplier on overload backlash (Amethyst hilt). */
  backlashMult: number;
  /** Step-by-step log for the packet trace view. */
  trace: string[];
  /** Problems with the build (too many flanks, etc.). */
  warnings: string[];
  stats: WandStats;
}

interface Entry {
  def: Crystal;
  q: number; // quality strength x knot x quartz bonuses
  qualityName: string;
  spineIndex: number; // original socket (0-based) before inversion
  zone: Zone;
  halos: Halo[];
}

interface Halo {
  def: Crystal;
  q: number;
  gap: number;
  /** The third socket a side slot reaches: half strength, never fuses. */
  far?: boolean;
}

/** Crystals that work harder in a given zone (the zone's job in the hilt -> shaft -> tip chain). */
const ZONE_BOOST: Record<Zone, { ids: Set<string>; mult: number; why: string }> = {
  hilt: { ids: new Set(['thriftstone', 'wellspring', 'siphon', 'sunstone']), mult: 1.5, why: 'the hilt feeds the base' },
  shaft: { ids: new Set(['twinspar', 'prismite', 'swiftquartz', 'bloatstone', 'needlepoint', 'seeker', 'mortar', 'echo-opal']), mult: 1.25, why: 'the shaft shapes the flight' },
  tip: { ids: new Set(['nova', 'lingerite', 'seedstone', 'lancet', 'ricochet']), mult: 1.5, why: 'the tip decides the impact' },
};
const HILT_BASE_BONUS = 1.2;

const COUNT_MODS = new Set(['twinspar', 'prismite', 'echo-opal', 'seedstone']);
const ARCANE_COLOR = '#c9b8ff';
const BASE_SPEED = 16; // world units per second at velocity 1

function reactionFor(core: string, coat: string): Reaction | null {
  return REACTIONS[`${core}>${coat}`] ?? null;
}

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

export function resolveShot(build: WandBuild, env: Env = DEFAULT_ENV): Shot {
  const stats = wandStats(build);
  const shaftId = stats.parts.shaft.id;
  const se = stats.shaftEffect;
  const ce = stats.tipEffect;
  const ge = stats.hiltEffect;
  const trace: string[] = [];
  const warnings: string[] = [];

  // ---------- 1. Draw / 2. Seed ----------
  trace.push(
    `Seed: ${stats.form.name}: ${stats.parts.hilt ? `${stats.parts.hilt.name} hilt` : 'no hilt'}, ${stats.parts.shaft.name} shaft, ${stats.parts.tip ? `${stats.parts.tip.name} tip` : 'no tip'}. ` +
      `Power ${stats.basePower}, Conductivity ${stats.conductivity} (boosts keep ${pct(stats.fadePerStep)} per step), Heat limit ${stats.heatLimit}.`,
  );

  // Build the ordered entry list from the spine (empty sockets are skipped).
  const slots = build.spine.slice(0, stats.sockets);
  if (build.spine.filter(Boolean).length > slots.filter(Boolean).length) warnings.push(`This ${stats.form.name.toLowerCase()} has ${stats.sockets} sockets; extra crystals ignored.`);

  const entryAt: (Entry | null)[] = slots.map((slot, i) => (slot ? makeEntry(slot, i, se, zoneOf(stats, i)) : null));
  let entries: Entry[] = entryAt.filter((e): e is Entry => e !== null);

  // ---------- 3. Halo pass (flank sockets) ----------
  const flankGaps = Object.keys(build.flanks)
    .map(Number)
    .sort((a, b) => a - b);
  let usedFlanks = 0;
  for (const gap of flankGaps) {
    const slot = build.flanks[gap];
    if (!slot) continue;
    if (gap < 0 || gap >= stats.sockets - 1) {
      warnings.push(`Flank ${gap + 1} does not exist on this wand.`);
      continue;
    }
    if (usedFlanks >= stats.maxFlanks) {
      warnings.push(`This wand has room for ${stats.maxFlanks} flank crystal${stats.maxFlanks === 1 ? '' : 's'}; extra flank ignored.`);
      continue;
    }
    usedFlanks++;
    const def = crystalDef(slot.id);
    const halo: Halo = { def, q: qualityDef(slot.quality).strength * modifierBonus(def, se), gap };
    const left = entryAt[gap];
    const right = entryAt[gap + 1];
    const beyond = entryAt[gap + 2];
    if (left) left.halos.push(halo);
    if (right) right.halos.push(halo);
    if (beyond) beyond.halos.push({ ...halo, q: halo.q * 0.5, far: true });
    trace.push(`Side slot: ${def.name} tints S${gap + 1} and S${gap + 2}${gap + 2 < stats.sockets ? `, and S${gap + 3} at half strength` : ''}.`);
  }

  // Inverter: reverse everything downstream of it (left to right).
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].def.id === 'inverter') {
      const head = entries.slice(0, i + 1);
      const tail = entries.slice(i + 1).reverse();
      entries = [...head, ...tail];
      if (tail.length > 1) trace.push(`Inverter at S${entries[i].spineIndex + 1} reverses the ${tail.length} crystals after it.`);
    }
  }

  // ---------- 4. Forward pass ----------
  const n = entries.length;
  let count = 1;
  let power = stats.basePower;
  let speed = stats.velocity * BASE_SPEED;
  let size = 1;
  let spreadDeg = 14;
  let pierce = 0;
  let bounces = 0;
  let homing = false;
  let aoeRadius = 0;
  let lingerSeconds = 0;
  let echoes = 0;
  let seeds = 0;
  let critChance = 0.05;
  let siphon = 0;
  let rechargeMult = 1;
  let drain = stats.baseDrain;
  let drainMult = 1;
  let heat = 0;
  let lob = false;
  let loopsWanted = 0;
  let dampener = false;
  let elementForm: Form | null = null;
  const tags: ElementId[] = [];
  const effects = new Set<string>();
  const byproducts = new Set<string>();
  const reactions: Reaction[] = [];
  let current: Reaction | null = null; // the packet's fused state
  let lastElement: { id: ElementId; pos: number } | null = null;
  const appliedFlankCounts = new Set<number>();
  const hasBloat = entries.some((e) => e.def.id === 'bloatstone');
  const hasSwift = entries.some((e) => e.def.id === 'swiftquartz');

  // Fade counts physical sockets between a crystal and the tip (empty sockets still count).
  const occupied = entries.map((e) => e.spineIndex).sort((a, b) => a - b);
  const tipSocket = stats.sockets - 1;
  const fadeAt = (i: number) => Math.pow(stats.fadePerStep, tipSocket - occupied[i]);

  const addTag = (t: ElementId) => {
    if (!tags.includes(t)) tags.push(t);
  };

  const catalystNear = (i: number, e: Entry): boolean => {
    if (e.halos.some((h) => h.def.id === 'catalyst')) return true;
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 1); k++) {
      if (k !== i && entries[k].def.id === 'catalyst') return true;
    }
    return false;
  };

  const applyElement = (el: ElementId, add: number, i: number, label: string, catalyzed: boolean, adjacentPrev: boolean) => {
    const def = ELEMENTS[el];
    power += add;
    addTag(el);
    def.onHit.forEach((x) => effects.add(x));
    let fused: Reaction | null = null;
    if (adjacentPrev && lastElement) {
      if (current) {
        fused = SECOND_ORDER[`${current.id}>${el}`] ?? null;
      } else {
        fused = reactionFor(lastElement.id, el);
      }
    }
    if (fused) {
      const bonus = (catalyzed ? 1.5 : 1.25) * (se.reactionBoost ?? 1);
      power *= bonus;
      current = fused;
      reactions.push(fused);
      fused.tags.forEach(addTag);
      fused.effects.forEach((x) => effects.add(x));
      trace.push(`${label}: ${def.name} +${add.toFixed(1)} power, fuses into ${fused.name} (x${bonus}${catalyzed ? ', catalyzed' : ''}).`);
    } else {
      if (current && adjacentPrev) {
        trace.push(`${label}: ${def.name} +${add.toFixed(1)} power; no reaction with ${current.name}, carried as a mixed shot.`);
      } else {
        trace.push(`${label}: ${def.name} +${add.toFixed(1)} power.`);
      }
    }
    elementForm = (def.form as Form) ?? elementForm;
    lastElement = { id: el, pos: i };
  };

  entries.forEach((e, i) => {
    const def = e.def;
    const q = e.q;
    const fade = fadeAt(i);
    const label = `${e.zone[0].toUpperCase() + e.zone.slice(1)} S${e.spineIndex + 1} ${def.name}${e.qualityName !== 'Clear' ? ` (${e.qualityName})` : ''}`;
    if (ZONE_BOOST[e.zone].ids.has(def.id)) trace.push(`${label}: x${ZONE_BOOST[e.zone].mult} because ${ZONE_BOOST[e.zone].why}.`);
    drain += Math.max(0, def.drain - (se.drainReduce ?? 0)) * count;
    heat += def.heat;
    if (def.element === 'fire' && se.fireHeat) heat += se.fireHeat;

    if (def.kind === 'element' && def.element) {
      const el = def.element;
      const elDef = ELEMENTS[el];
      // each element answers to the material of the zone it sits in
      const zoneMat: Material = (e.zone === 'hilt' ? stats.parts.hilt : e.zone === 'tip' ? stats.parts.tip : null) ?? stats.parts.shaft;
      let mood = 1;
      if (elDef.harmony.includes(zoneMat.id)) mood = 1.25;
      else if (elDef.clash.includes(zoneMat.id)) {
        mood = 0.8;
        heat += 1;
        byproducts.add(elDef.byproduct.name);
        effects.add(elDef.byproduct.effect);
      }
      const dragon = se.fireDouble && el === 'fire' ? 2 : 1;
      const boost = se.elementBoost?.[el] ?? 1;
      const base = e.zone === 'hilt' ? HILT_BASE_BONUS : 1;
      const add = (def.power ?? 10) * q * mood * fade * dragon * boost * base;
      if (base !== 1) trace.push(`${label}: in the hilt it sets the base (x${HILT_BASE_BONUS}).`);
      const prev = i > 0 ? entries[i - 1] : null;
      const adjacentPrev =
        !!lastElement &&
        ((prev !== null && lastElement.pos === i - 1) ||
          // non-adjacent elements within 2 sockets react when a Catalyst is near (but never across a Null Stone)
          (catalystNear(i, e) && lastElement.pos >= i - 2 && !(prev && prev.def.id === 'null')));
      const catalyzed = adjacentPrev && catalystNear(i, e);
      if (mood !== 1) trace.push(`${label}: ${mood > 1 ? 'harmony' : 'clash'} with the ${zoneMat.name} ${e.zone} (x${mood})${mood < 1 ? `, +1 Heat, ${elDef.byproduct.name} added` : ''}.`);
      applyElement(el, add, i, label, catalyzed, adjacentPrev);

      // An element tint from a flank fuses with this crystal (this crystal is the core).
      for (const h of e.halos) {
        if (h.def.kind === 'element' && h.def.element && !h.far) {
          const tint = h.def.element;
          const r = current ? SECOND_ORDER[`${(current as Reaction).id}>${tint}`] ?? null : reactionFor(el, tint);
          if (r) {
            power *= 1.25 * (se.reactionBoost ?? 1);
            current = r;
            reactions.push(r);
            r.tags.forEach(addTag);
            r.effects.forEach((x) => effects.add(x));
            trace.push(`  Flank ${h.def.name} tints it into ${r.name} (x1.25).`);
          } else {
            addTag(tint);
          }
        }
      }
    } else {
      applyModifier(def.id, q, fade, i, label);
    }

    // Modifier halos from flanks act on this neighbor at 60%.
    for (const h of e.halos) {
      if (h.def.kind === 'element') {
        if (def.kind !== 'element' && h.def.element) {
          power += (h.def.power ?? 10) * 0.6 * h.q * fade;
          addTag(h.def.element);
          trace.push(`  Flank ${h.def.name} adds its element at 60%.`);
        }
        continue;
      }
      if (h.def.id === 'catalyst') continue; // handled in reaction checks
      if (COUNT_MODS.has(h.def.id)) {
        if (appliedFlankCounts.has(h.gap)) continue;
        appliedFlankCounts.add(h.gap);
        applyModifier(h.def.id, h.q, fade, i, `  Flank ${h.def.name}`);
      } else {
        applyModifier(h.def.id, h.q * 0.6, fade, i, `  Flank ${h.def.name} (60%)`);
      }
    }
  });

  function applyModifier(id: string, q: number, fade: number, i: number, label: string) {
    switch (id) {
      case 'sunstone': {
        const m = 1 + 0.4 * q * fade;
        power *= m;
        trace.push(`${label}: power x${m.toFixed(2)}.`);
        break;
      }
      case 'twinspar': {
        count *= 2;
        power *= 0.6;
        trace.push(`${label}: 2 copies at 60% each; later crystals cost x${count}.`);
        break;
      }
      case 'prismite': {
        const k = q >= 1.6 ? 5 : 3;
        count *= k;
        power *= k === 5 ? 0.32 : 0.45;
        const nearWind = [i - 1, i + 1].some((k2) => entries[k2]?.def.element === 'wind');
        spreadDeg = nearWind ? 120 : 34;
        trace.push(`${label}: fan of ${k}${nearWind ? ', widened to a 120° cone by Wind' : ''}.`);
        break;
      }
      case 'echo-opal':
        echoes += 1;
        trace.push(`${label}: echo 0.5 s later at 60%.`);
        break;
      case 'seedstone':
        seeds = Math.max(seeds, Math.round(4 * q));
        trace.push(`${label}: bursts into ${seeds} seedlings on impact.`);
        break;
      case 'swiftquartz': {
        if (!hasBloat) speed *= 1 + 0.6 * q * fade;
        if (i === n - 1) pierce += 1;
        trace.push(`${label}: faster${i === n - 1 ? ', +1 pierce at the tip' : ''}${hasBloat ? ' (cancelled by Bloatstone)' : ''}.`);
        break;
      }
      case 'lancet': {
        pierce += Math.max(1, Math.round(2 * q));
        if (tags.includes('fire')) effects.add('burnSpread');
        trace.push(`${label}: pierces ${Math.max(1, Math.round(2 * q))}${tags.includes('fire') ? ', burn spreads on each pierce' : ''}.`);
        break;
      }
      case 'ricochet':
        bounces += Math.max(1, Math.round(3 * q));
        if (tags.includes('earth')) effects.add('bouncePower');
        trace.push(`${label}: bounces ${bounces}${tags.includes('earth') ? ', +15% power per bounce' : ''}.`);
        break;
      case 'seeker':
        homing = true;
        trace.push(`${label}: homing.`);
        break;
      case 'mortar':
        lob = true;
        trace.push(`${label}: lobbed in an arc.`);
        break;
      case 'bloatstone': {
        const m = 1 + 0.3 * q * fade;
        power *= m;
        if (!hasSwift) {
          size *= 1 + 0.6 * q;
          speed *= 0.7;
        }
        trace.push(`${label}: power x${m.toFixed(2)}${hasSwift ? ' (size and speed cancelled by Swiftquartz)' : ', bigger and slower'}.`);
        break;
      }
      case 'needlepoint':
        size *= 0.6;
        speed *= 1.3;
        critChance += 0.25 * q;
        trace.push(`${label}: smaller, faster, +${Math.round(25 * q)}% crit.`);
        break;
      case 'nova':
        aoeRadius = Math.max(aoeRadius, 2.2 + 1.2 * q);
        effects.add('aoe');
        trace.push(`${label}: explodes on impact (radius ${aoeRadius.toFixed(1)}).`);
        break;
      case 'lingerite':
        lingerSeconds = Math.max(lingerSeconds, 4 * q);
        effects.add('zone');
        trace.push(`${label}: leaves a zone for ${lingerSeconds.toFixed(1)} s.`);
        break;
      case 'thriftstone':
        drainMult *= 1 - 0.3 * Math.min(q, 2);
        if (i === 0) heat -= 1;
        trace.push(`${label}: drain -${Math.round(30 * q)}%${i === 0 ? ', -1 Heat in the root' : ''}.`);
        break;
      case 'wellspring':
        rechargeMult *= 1 + 0.5 * q;
        trace.push(`${label}: recharge x${(1 + 0.5 * q).toFixed(2)}.`);
        break;
      case 'siphon':
        siphon += 0.3 * q;
        trace.push(`${label}: ${Math.round(siphon * 100)}% of damage refills the wand.`);
        break;
      case 'resonator':
        loopsWanted += 1;
        trace.push(`${label}: feedback loop queued.`);
        break;
      case 'catalyst':
        trace.push(`${label}: catalyzes nearby reactions.`);
        break;
      case 'inverter':
        trace.push(`${label}: order flipped downstream.`);
        break;
      case 'null':
        trace.push(`${label}: spacer, blocks reactions across it.`);
        break;
      case 'dampener':
        dampener = true;
        trace.push(`${label}: -1 Heat, feedback capped.`);
        break;
      default:
        trace.push(`${label}: (no lab effect yet).`);
    }
  }

  // ---------- 5. Feedback pass ----------
  if (se.spiral && n > 0) {
    loopsWanted += 1;
    trace.push(`${stats.parts.shaft.name} spiral: the tip feeds back into the root (+1 loop).`);
  }
  let loops = dampener ? Math.min(loopsWanted, 1) : loopsWanted;
  if (se.loopCap !== undefined && loops > se.loopCap) {
    loops = se.loopCap;
    trace.push(`${stats.parts.shaft.name} caps feedback at ${se.loopCap} loop.`);
  }
  const loopStrength = se.loopStrength ?? 0.4;
  if (loops > 0) {
    let extra = 0;
    for (let k = 1; k <= loops; k++) extra += Math.pow(loopStrength, k);
    power *= 1 + extra;
    const loopHeat = loops * (dampener ? 0.5 : 1);
    heat += loopHeat;
    trace.push(`Feedback: ${loops} loop(s) at ${pct(loopStrength)}, power x${(1 + extra).toFixed(2)}, +${loopHeat} Heat.`);
  }

  // ---------- Form, shaft and tip finish the shot ----------
  if (stats.form.powerMult !== 1) {
    power *= stats.form.powerMult;
    trace.push(`${stats.form.name}: power x${stats.form.powerMult}.`);
  }
  if (se.powerMult) {
    power *= se.powerMult;
    trace.push(`${stats.parts.shaft.name} shaft: power x${se.powerMult}.`);
  }
  const tipName = stats.parts.tip ? `${stats.parts.tip.name} tip` : '';
  if (ce.fireBoost && tags.includes('fire')) {
    power *= ce.fireBoost;
    trace.push(`${tipName}: Fire shots x${ce.fireBoost}.`);
  }
  if (ce.nightPower) {
    const m = env.time === 'night' ? 1.5 : 0.75;
    power *= m;
    trace.push(`${tipName}: x${m} at ${env.time === 'night' ? 'night' : 'day'}.`);
  }
  if (ce.heavy) {
    power *= 1.1;
    size *= 1.3;
    trace.push(`${tipName}: heavier shot, x1.1 power.`);
  }
  if (ce.crit) critChance += ce.crit;
  if (ce.pierceBonus) pierce += ce.pierceBonus;
  if (ce.bounceBonus) bounces += ce.bounceBonus;
  if (ce.seeds) seeds = Math.max(seeds, ce.seeds);
  ce.addEffects?.forEach((x) => effects.add(x));
  if (ce.freeze && tags.includes('water')) {
    effects.add('root');
    effects.add('freeze');
    trace.push(`${tipName}: Water freezes targets in place.`);
  }
  if (ge.steady) spreadDeg *= ge.steady;
  const sideCopies = ce.sideCopies ?? 0;

  // ---------- 6. Heat (per-shot total; the overload check happens when firing) ----------
  if (se.heatPerShot) heat += se.heatPerShot;
  heat = Math.max(0, heat);
  trace.push(`Heat: this shot adds ${heat} (limit ${stats.heatLimit}).`);

  // ---------- 7. Release ----------
  const finalReaction = current as Reaction | null;
  let form: Form = elementForm ?? 'arcane';
  if (lob || finalReaction?.effects.includes('lob')) form = 'lob';
  const lastEl = lastElement as { id: ElementId; pos: number } | null;
  const color = finalReaction ? finalReaction.color : lastEl ? ELEMENTS[lastEl.id].color : ARCANE_COLOR;
  const finalDrain = Math.max(1, Math.round(drain * drainMult));
  trace.push(
    `Release: ${count} x ${power.toFixed(1)} power${sideCopies ? ` + ${sideCopies} side copies` : ''}, ${form}, drain ${finalDrain}.`,
  );

  return {
    count,
    powerEach: Math.round(power * 10) / 10,
    sideCopies,
    sideCopyPower: Math.round(power * 0.3 * 10) / 10,
    tags,
    reaction: finalReaction,
    reactions,
    form,
    color,
    speed: Math.round(speed * 10) / 10,
    size: Math.round(size * 100) / 100,
    spreadDeg,
    pierce,
    bounces,
    homing,
    aoeRadius,
    lingerSeconds,
    echoes,
    seeds,
    critChance: Math.min(1, critChance),
    siphon,
    rechargeMult,
    effects: [...effects],
    byproducts: [...byproducts],
    loops,
    drain: finalDrain,
    heat,
    chainBonus: ce.chainBonus ?? 0,
    magnet: !!ce.magnet,
    mark: !!ce.mark,
    steer: !!ce.steer,
    replayEvery: ce.replay ?? 0,
    backlashMult: ge.calm ?? 1,
    trace,
    warnings,
    stats,
  };
}

function modifierBonus(def: Crystal, se: PartEffect): number {
  return def.kind === 'modifier' ? se.modifierBoost ?? 1 : 1;
}

function makeEntry(slot: CrystalSlot, index: number, se: PartEffect, zone: Zone): Entry {
  const def = crystalDef(slot.id);
  const qd = qualityDef(slot.quality);
  let q = qd.strength * modifierBonus(def, se);
  if (se.knot && index === 1) q *= 2; // the knot socket
  if (ZONE_BOOST[zone].ids.has(def.id)) q *= ZONE_BOOST[zone].mult;
  return { def, q, qualityName: qd.name, spineIndex: index, zone, halos: [] };
}

/** Damage multiplier of a shot against a target category, including immunities. */
export function damageMultiplier(shot: Pick<Shot, 'tags' | 'reaction' | 'stats'>, category: string, immune: string[] = []): number {
  const bite = shot.stats.bite[category] ?? 1;
  if (shot.tags.length === 0) return bite;
  const ignoreFireResist = shot.reaction?.effects.includes('ignoreFireResist');
  let sum = 0;
  for (const t of shot.tags) {
    if (immune.includes(t)) {
      sum += ignoreFireResist && t === 'fire' ? 0.5 : 0;
      continue;
    }
    sum += ELEMENTS[t].vs[category] ?? 1;
  }
  return bite * (sum / shot.tags.length);
}
