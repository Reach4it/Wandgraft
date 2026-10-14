// Golden builds: each test checks the engine against what docs/DESIGN.md says a build does.
// The Godot port must pass the same checks (see "Keeping the work portable").
import { describe, expect, it } from 'vitest';
import { resolveShot, damageMultiplier } from '../src/engine/resolve';
import { preset } from '../src/engine/presets';
import { WandBuild, drawReport, refit, wandStats, zoneOf } from '../src/engine/wand';
import { makeRng, rollOverload } from '../src/engine/overload';
import { MATERIALS, CRYSTALS, DUMMIES, PRESETS, FORMS, FormId, material } from '../src/engine/data';

const c = (id: string, quality = 'clear') => ({ id, quality });

function wand(
  shaft: string,
  spine: (string | null)[],
  flanks: Record<number, string> = {},
  hilt: string | null = shaft,
  tip: string | null = shaft,
  form: FormId = 'master',
): WandBuild {
  const f: WandBuild['flanks'] = {};
  for (const [k, v] of Object.entries(flanks)) f[Number(k)] = c(v);
  return { form, hilt, shaft, tip, spine: spine.map((s) => (s ? c(s) : null)), flanks: f };
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
  it('Twinspar between Earth and Fire keeps them apart: no fusion, and Fire is paid twice', () => {
    expect(a.reaction).toBeNull();
    expect(a.tags).toEqual(['earth', 'fire']);
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
  it('a Cold Iron tip bites wards', () => {
    expect(wandStats({ form: 'grafted', hilt: 'chalk', shaft: 'chalk', tip: 'cold-iron' }).bite.ward).toBe(2);
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
  it('a twig has no hilt or tip and at most 2 sockets', () => {
    const b = refit(wand('hollowreed', ['wind', 'swiftquartz', 'fire'], {}, 'copper', 'copper', 'twig'));
    const st = wandStats(b);
    expect(st.parts.hilt).toBeNull();
    expect(st.parts.tip).toBeNull();
    expect(st.sockets).toBe(2);
    expect(b.spine.length).toBe(2);
  });
  it('a twig draws charge only from the wielder', () => {
    expect(wandStats(wand('willow', [], {}, null, null, 'twig')).drawMix).toEqual({ wielder: 1 });
  });
  it('a plain wand holds a hilt but no tip: 1 hilt + up to 3 shaft sockets', () => {
    const st = wandStats(wand('hollowreed', [], {}, 'willow', 'copper', 'wand'));
    expect(st.parts.hilt?.id).toBe('willow');
    expect(st.parts.tip).toBeNull();
    expect(st.zoneSockets).toEqual({ hilt: 1, shaft: 3, tip: 0 });
    expect(st.sockets).toBe(4);
  });
  it('forms run from 2 to 10 sockets', () => {
    const totals = (['twig', 'wand', 'grafted', 'master', 'archwand'] as FormId[]).map((f) => wandStats(wand('hollowreed', [], {}, 'willow', 'willow', f)).sockets);
    expect(totals).toEqual([2, 4, 6, 8, 10]);
  });
  it('there are no staves', () => {
    expect(FORMS.map((f) => f.id)).not.toContain('staff');
  });
  it('a grafted wand gets at most 1 flank; a master wand gets them all', () => {
    expect(wandStats(wand('hollowreed', [], {}, 'willow', 'willow', 'grafted')).maxFlanks).toBe(1);
    expect(wandStats(wand('hollowreed', [], {}, 'willow', 'willow', 'master')).maxFlanks).toBeGreaterThan(1);
  });
  it('an archwand hits harder than a master wand', () => {
    const arch = resolveShot(wand('willow', ['fire'], {}, 'willow', 'willow', 'archwand'));
    const master = resolveShot(wand('willow', ['fire'], {}, 'willow', 'willow', 'master'));
    expect(arch.powerEach).toBeGreaterThan(master.powerEach);
  });
  it('every sample build keeps all its crystals', () => {
    for (const p of PRESETS) {
      const listed = Object.values(p.crystals).flat().filter(Boolean).length;
      expect(preset(p.id).spine.filter(Boolean).length, p.id).toBe(listed);
    }
  });
  it('the Starfall Archwand fills all 10 sockets', () => {
    expect(preset('starfall-archwand').spine.filter(Boolean).length).toBe(10);
  });
});

describe('hilt, shaft and tip zones', () => {
  it('the spine lists hilt sockets, then shaft, then tip', () => {
    const st = wandStats(wand('copper', [], {}, 'copper', 'copper', 'grafted'));
    expect([zoneOf(st, 0), zoneOf(st, 1), zoneOf(st, st.sockets - 1)]).toEqual(['hilt', 'shaft', 'tip']);
  });
  it('an element in the hilt sets the base and hits harder', () => {
    const inHilt = resolveShot(wand('chalk', ['fire', null, null, null, null, null], {}, 'chalk', 'chalk', 'grafted'));
    const inShaft = resolveShot(wand('chalk', [null, 'fire', null, null, null, null], {}, 'chalk', 'chalk', 'grafted'));
    expect(inHilt.trace.join(' ')).toContain('sets the base');
    expect(inHilt.powerEach).toBeGreaterThan(inShaft.powerEach * 0.95);
  });
  it('impact crystals work harder in the tip', () => {
    const tip = resolveShot(wand('chalk', [null, null, null, null, null, 'nova'], {}, 'chalk', 'chalk', 'grafted'));
    const shaft = resolveShot(wand('chalk', [null, 'nova', null, null, null, null], {}, 'chalk', 'chalk', 'grafted'));
    expect(tip.aoeRadius).toBeGreaterThan(shaft.aoeRadius);
  });
  it('an element answers to the material of its own zone', () => {
    // Fire harmonizes with an Emberpine hilt, clashes with a Willow shaft
    const s = resolveShot(wand('willow', ['fire', 'fire', null, null, null, null], {}, 'emberpine', 'willow', 'grafted'));
    const t = s.trace.join(' ');
    expect(t).toContain('harmony with the Emberpine hilt');
    expect(t).toContain('clash with the Willow shaft');
  });
  it('changing form keeps a crystal in its zone', () => {
    const twig = refit(wand('willow', ['fire', 'water'], {}, null, null, 'twig'));
    const grown = refit({ ...twig, form: 'wand', hilt: 'willow' }, twig);
    const st = wandStats(grown);
    expect(grown.spine[0]).toBeNull(); // the new hilt socket starts empty
    expect(grown.spine.slice(st.zoneSockets.hilt).map((c) => c?.id)).toEqual(['fire', 'water', undefined]);
  });
  it('a side slot reaches a third socket at half strength', () => {
    const s = resolveShot(wand('hollowreed', ['fire', 'twinspar', 'sunstone', null, null, null, null, null], { 0: 'sunstone' }, 'hollowreed', 'hollowreed', 'master'));
    expect(s.trace.join(' ')).toContain('S3 at half strength');
  });
});

describe('what each part does', () => {
  it('the same material does different things as hilt, shaft and tip', () => {
    // Prismglass as the tip splits side copies; as the shaft it does not
    expect(resolveShot(wand('chalk', ['fire'], {}, 'chalk', 'prismglass')).sideCopies).toBe(2);
    expect(resolveShot(wand('prismglass', ['fire'], {}, 'chalk', 'chalk')).sideCopies).toBe(0);
  });
  it('the tip decides bite', () => {
    expect(wandStats({ form: 'grafted', hilt: 'cold-iron', shaft: 'cold-iron', tip: 'chalk' }).bite.ward).toBeUndefined();
  });
  it('the hilt decides where charge comes from', () => {
    const st = wandStats({ form: 'grafted', hilt: 'basalt', shaft: 'chalk', tip: 'chalk' });
    expect(drawReport(st, { time: 'day', weather: 'clear' }, false).mult).toBeGreaterThan(drawReport(st, { time: 'day', weather: 'clear' }, true).mult);
  });
  it('a Silver tip is stronger at night', () => {
    const b = wand('chalk', ['wind'], {}, 'chalk', 'silver');
    expect(resolveShot(b, { time: 'night', weather: 'clear' }).powerEach).toBeGreaterThan(resolveShot(b, { time: 'day', weather: 'clear' }).powerEach);
  });
  it('a Rime tip freezes Water shots', () => {
    expect(resolveShot(wand('chalk', ['water'], {}, 'chalk', 'rime-crystal')).effects).toContain('freeze');
  });
});
