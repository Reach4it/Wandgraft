// Golden builds: each test checks the engine against what docs/DESIGN.md says a build does.
// The Godot port must pass the same checks (see "Keeping the work portable").
import { describe, expect, it } from 'vitest';
import { resolveShot, damageMultiplier } from '../src/engine/resolve';
import { preset } from '../src/engine/presets';
import { WandBuild, drawReport, refit, wandStats } from '../src/engine/wand';
import { makeRng, rollOverload } from '../src/engine/overload';
import { MATERIALS, CRYSTALS, DUMMIES, PRESETS, FormId, material } from '../src/engine/data';

const c = (id: string, quality = 'clear') => ({ id, quality });

function wand(
  shaft: string,
  spine: (string | null)[],
  flanks: Record<number, string> = {},
  grip: string | null = shaft,
  cap: string | null = shaft,
  form: FormId = 'master',
): WandBuild {
  const f: WandBuild['flanks'] = {};
  for (const [k, v] of Object.entries(flanks)) f[Number(k)] = c(v);
  return { form, grip, shaft, cap, spine: spine.map((s) => (s ? c(s) : null)), flanks: f };
}

describe('data', () => {
  it('has every material from the design doc', () => {
    expect(MATERIALS.length).toBe(34);
  });
  it('every preset resolves without warnings', () => {
    for (const p of PRESETS) expect(resolveShot(preset(p.id)).warnings, p.id).toEqual([]);
  });
  it('has crystals and the first six dummies', () => {
    expect(CRYSTALS.filter((x) => x.kind === 'element').length).toBe(4);
    expect(DUMMIES.length).toBe(6);
  });
});

describe('order matters (Basalt wand)', () => {
  const a = resolveShot(preset('basalt-a')); // Earth -> Twinspar -> Fire
  const b = resolveShot(preset('basalt-b')); // Earth -> Fire -> Twinspar

  it('both make two projectiles', () => {
    expect(a.count).toBe(2);
    expect(b.count).toBe(2);
  });
  it('Earth core with a Fire coat fuses into a Volcanic Lob (reaction table)', () => {
    expect(b.reaction?.name).toBe('Volcanic Lob');
    expect(b.form).toBe('lob');
  });
  it('Twinspar before Fire: each copy is stronger, but Fire is paid twice', () => {
    expect(a.powerEach).toBeGreaterThan(b.powerEach);
    expect(a.drain).toBeGreaterThan(b.drain);
  });
});

describe('core and coat', () => {
  it('Fire then Water is a Steam Bomb; Water then Fire is a Boiling Jet', () => {
    expect(resolveShot(wand('chalk', ['fire', 'water'])).reaction?.name).toBe('Steam Bomb');
    expect(resolveShot(wand('chalk', ['water', 'fire'])).reaction?.name).toBe('Boiling Jet');
  });
  it('a modifier between two elements stops the reaction', () => {
    const s = resolveShot(wand('chalk', ['fire', 'sunstone', 'water']));
    expect(s.reaction).toBeNull();
    expect(s.tags).toEqual(['fire', 'water']);
  });
  it('Null Stone blocks reactions even with a Catalyst nearby', () => {
    const s = resolveShot(wand('hollowreed', ['catalyst', 'fire', 'null', 'water']));
    expect(s.reaction).toBeNull();
  });
  it('a Catalyst lets elements two sockets apart react', () => {
    const s = resolveShot(wand('hollowreed', ['fire', 'catalyst', 'water']));
    expect(s.reaction?.name).toBe('Steam Bomb');
  });
  it('fused elements keep reacting: Steam + Earth = Geyser', () => {
    const s = resolveShot(wand('hollowreed', ['fire', 'water', 'earth']));
    expect(s.reactions.map((r) => r.name)).toEqual(['Steam Bomb', 'Geyser']);
  });
  it('the Inverter flips core and coat', () => {
    const s = resolveShot(wand('hollowreed', ['inverter', 'fire', 'water']));
    expect(s.reaction?.name).toBe('Boiling Jet');
  });
});

describe('Scalding Lance (Willow)', () => {
  const s = resolveShot(preset('scalding-lance'));
  it('is a Boiling Jet', () => expect(s.reaction?.name).toBe('Boiling Jet'));
  it('Fire clashes with Willow and leaves steam mist', () => expect(s.byproducts).toContain('Steam mist'));
  it('pierces a line of enemies (Lancet + Swiftquartz at the tip)', () => expect(s.pierce).toBeGreaterThanOrEqual(3));
  it('is faster than a bare Willow shot', () => {
    expect(s.speed).toBeGreaterThan(resolveShot(wand('willow', [null])).speed);
  });
});

describe('Storm Shepherd (Copper + Catalyst flank)', () => {
  const s = resolveShot(preset('storm-shepherd'));
  it('makes a catalyzed Storm Bolt', () => {
    expect(s.reaction?.name).toBe('Storm Bolt');
    expect(s.trace.join('\n')).toContain('catalyzed');
  });
  it('fans into three homing bolts with an echo', () => {
    expect(s.count).toBe(3);
    expect(s.homing).toBe(true);
    expect(s.echoes).toBe(1);
  });
  it("Copper's perfect conductivity means nothing fades", () => {
    expect(s.stats.fadePerStep).toBe(1);
  });
});

describe('Wildfire Reaper (Ashen Yew)', () => {
  const s = resolveShot(preset('wildfire-reaper'));
  it('is a Wildfire that refills the wand', () => {
    expect(s.reaction?.name).toBe('Wildfire');
    expect(s.siphon).toBeGreaterThan(0);
  });
});

describe('Greed Loop (Nautilus + Resonator)', () => {
  const s = resolveShot(preset('greed-loop'));
  it('runs two feedback loops (spiral + Resonator)', () => expect(s.loops).toBe(2));
  it('one shot is fine, two in a row overload', () => {
    expect(s.heat).toBeLessThanOrEqual(s.stats.heatLimit);
    expect(s.heat * 2).toBeGreaterThan(s.stats.heatLimit);
  });
  it('a Dampener caps the loops at 1', () => {
    expect(resolveShot(wand('nautilus', ['sunstone', 'fire', 'resonator', 'dampener'])).loops).toBe(1);
  });
});

describe('conductivity fade', () => {
  it('a Sunstone far from the tip is weaker on Cold Iron than on Copper', () => {
    const iron = resolveShot(wand('cold-iron', ['sunstone', null, null], {}, 'copper', 'copper'));
    const ironTip = resolveShot(wand('cold-iron', [null, null, 'sunstone'], {}, 'copper', 'copper'));
    expect(ironTip.powerEach).toBeGreaterThan(iron.powerEach);
  });
});

describe('quality tiers', () => {
  it('Flawless Prismite fires 5', () => {
    const s = resolveShot({ ...wand('chalk', []), spine: [c('prismite', 'flawless'), null, null, null] });
    expect(s.count).toBe(5);
  });
  it('better quality means more power', () => {
    const chipped = resolveShot({ ...wand('chalk', []), spine: [c('fire', 'chipped'), null, null, null] });
    const flawless = resolveShot({ ...wand('chalk', []), spine: [c('fire', 'flawless'), null, null, null] });
    expect(flawless.powerEach).toBeGreaterThan(chipped.powerEach);
  });
});

describe('flanks', () => {
  it('a Water flank between two Fire crystals makes steam', () => {
    const s = resolveShot(wand('chalk', ['fire', 'fire', null, null], { 0: 'water' }));
    expect(s.reactions.some((r) => r.name === 'Steam Bomb')).toBe(true);
  });
  it('a shaft without flank sockets ignores flanks', () => {
    const s = resolveShot(wand('cold-iron', ['fire', 'water', null], { 0: 'catalyst' }));
    expect(s.warnings.length).toBe(1);
  });
});

describe('targets', () => {
  it('the Ember Golem shrugs off Fire but not Water', () => {
    const fire = resolveShot(wand('chalk', ['fire']));
    const water = resolveShot(wand('chalk', ['water']));
    expect(damageMultiplier(fire, 'fireborn', ['fire'])).toBe(0);
    expect(damageMultiplier(water, 'fireborn', ['fire'])).toBeGreaterThan(1);
  });
  it('a Cold Iron cap bites wards', () => {
    expect(wandStats({ form: 'grafted', grip: 'chalk', shaft: 'chalk', cap: 'cold-iron' }).bite.ward).toBe(2);
  });
});

describe('overload', () => {
  it('rolls are repeatable with a seed', () => {
    const a = rollOverload(3, makeRng(42));
    const b = rollOverload(3, makeRng(42));
    expect(a).toEqual(b);
  });
  it('Emberpine never fizzles', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 200; i++) expect(rollOverload(2, rng, material('emberpine').shaft.effect).kind).not.toBe('fizzle');
  });
});

describe('wand forms', () => {
  it('a twig has no grip or cap and at most 2 sockets', () => {
    const b = refit(wand('hollowreed', ['wind', 'swiftquartz', 'fire'], {}, 'copper', 'copper', 'twig'));
    const st = wandStats(b);
    expect(st.parts.grip).toBeNull();
    expect(st.parts.cap).toBeNull();
    expect(st.sockets).toBe(2);
    expect(b.spine.length).toBe(2);
  });
  it('a twig draws charge only from the wielder', () => {
    expect(wandStats(wand('willow', [], {}, null, null, 'twig')).drawMix).toEqual({ wielder: 1 });
  });
  it('a plain wand holds a grip but no cap, up to 3 sockets', () => {
    const st = wandStats(wand('hollowreed', [], {}, 'willow', 'copper', 'wand'));
    expect(st.parts.grip?.id).toBe('willow');
    expect(st.parts.cap).toBeNull();
    expect(st.sockets).toBe(3);
  });
  it('a grafted wand gets at most 1 flank; a master wand gets them all', () => {
    expect(wandStats(wand('hollowreed', [], {}, 'willow', 'willow', 'grafted')).maxFlanks).toBe(1);
    expect(wandStats(wand('hollowreed', [], {}, 'willow', 'willow', 'master')).maxFlanks).toBeGreaterThan(1);
  });
  it('a staff adds 2 sockets up to 7 and hits harder', () => {
    expect(wandStats(wand('willow', [], {}, 'willow', 'willow', 'staff')).sockets).toBe(6);
    expect(wandStats(wand('hollowreed', [], {}, 'willow', 'willow', 'staff')).sockets).toBe(7);
    const staff = resolveShot(wand('willow', ['fire'], {}, 'willow', 'willow', 'staff'));
    const master = resolveShot(wand('willow', ['fire'], {}, 'willow', 'willow', 'master'));
    expect(staff.powerEach).toBeGreaterThan(master.powerEach);
  });
  it('every sample build fits its form', () => {
    for (const p of PRESETS) {
      const used = p.spine.filter(Boolean).length;
      expect(used, p.id).toBeLessThanOrEqual(wandStats(preset(p.id)).sockets);
    }
  });
});

describe('what each part does', () => {
  it('the same material does different things as grip, shaft and cap', () => {
    // Prismglass as the cap splits side copies; as the shaft it does not
    expect(resolveShot(wand('chalk', ['fire'], {}, 'chalk', 'prismglass')).sideCopies).toBe(2);
    expect(resolveShot(wand('prismglass', ['fire'], {}, 'chalk', 'chalk')).sideCopies).toBe(0);
  });
  it('the cap decides bite', () => {
    expect(wandStats({ form: 'grafted', grip: 'cold-iron', shaft: 'cold-iron', cap: 'chalk' }).bite.ward).toBeUndefined();
  });
  it('the grip decides where charge comes from', () => {
    const st = wandStats({ form: 'grafted', grip: 'basalt', shaft: 'chalk', cap: 'chalk' });
    expect(drawReport(st, { time: 'day', weather: 'clear' }, false).mult).toBeGreaterThan(drawReport(st, { time: 'day', weather: 'clear' }, true).mult);
  });
  it('a Silver cap is stronger at night', () => {
    const b = wand('chalk', ['wind'], {}, 'chalk', 'silver');
    expect(resolveShot(b, { time: 'night', weather: 'clear' }).powerEach).toBeGreaterThan(resolveShot(b, { time: 'day', weather: 'clear' }).powerEach);
  });
  it('a Rime cap freezes Water shots', () => {
    expect(resolveShot(wand('chalk', ['water'], {}, 'chalk', 'rime-crystal')).effects).toContain('freeze');
  });
});
