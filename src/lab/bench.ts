// The wand bench: wand form, the built wand (3D view plus a drag-and-drop layout of hilt,
// shaft, sockets and tip), the shot readout, the parts list with what each material does
// in each slot, and the crystal palette.
import {
  CRYSTALS,
  DRAW_SOURCES,
  ELEMENTS,
  ElementId,
  FORMS,
  Family,
  MATERIALS,
  Material,
  PRESETS,
  QUALITIES,
  Zone,
  crystal,
  material,
} from '../engine/data';
import { buildFromPreset } from '../engine/presets';
import { WandBuild, drawReport, zoneOf, zoneRange } from '../engine/wand';
import { LabState, emit, loadBlueprints, saveBlueprint, setBuild, state } from './state';
import { toast } from './toast';
import { WandView } from './wandModel';

const FAMILY_NAMES: Record<Family, string> = {
  wood: 'Woods',
  metal: 'Metals',
  stone: 'Stone',
  bone: 'Bone',
  crystal: 'Crystal bodies',
  exotic: 'Exotics',
};
const GROUPS = ['Elements', 'Power', 'Count', 'Form', 'Size', 'Economy', 'Meta'];
const ZONE_NAMES: Record<Zone, string> = { hilt: 'hilt', shaft: 'shaft', tip: 'tip' };
const ZONE_ROLE: Record<Zone, string> = { hilt: 'sets the base', shaft: 'shapes the flight', tip: 'exit and impact' };
const ZONE_SHORT: Record<Zone, string> = { hilt: 'the base', shaft: 'the flight', tip: 'the impact' };

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const pct = (x: number) => `${Math.round(x * 100)}%`;

let view: WandView | null = null;
let lastViewBuild: WandBuild | null = null;
let lastViewColor = '';

// ---------- skeleton (built once; the 3D view canvas must survive re-renders) ----------
export function mountBench(root: HTMLElement) {
  root.innerHTML = `
    <header class="bench-head">
      <h1>wandGraft</h1>
      <p class="sub">Wand Lab</p>
      <p>Graft a wand, socket crystals, and test it on the range. Everything here is a free practice copy.</p>
    </header>
    <section class="block" id="b-load"></section>
    <section class="block">
      <h2 class="block-title">Your wand</h2>
      <div id="b-forms"></div>
      <canvas id="wand-view" aria-label="Your wand, turning slowly"></canvas>
    </section>
    <div id="b-wand" class="sticky-wand"></div>
    <section class="block" id="b-stats"></section>
    <section class="block" id="b-shot"></section>
    <section class="block">
      <h2 class="block-title">Parts</h2>
      <p class="help">Every material can be a hilt, a shaft or a tip, and does something different in each. Drag one onto the wand, or pick it and use the buttons.</p>
      <div id="b-partcard"></div>
      <div id="b-parts"></div>
    </section>
    <section class="block">
      <h2 class="block-title">Crystals</h2>
      <div id="b-crystals"></div>
    </section>`;
  view = new WandView(root.querySelector('#wand-view') as HTMLCanvasElement);
}

// ---------- pieces ----------
function gem(id: string, qualityId?: string): string {
  const c = crystal(id);
  const q = qualityId ? QUALITIES.find((x) => x.id === qualityId) : undefined;
  const tier = q && q.id !== 'clear' ? `<span class="tier">${q.name[0]}</span>` : '';
  return `<span class="gem" style="--gem:${c.color}" aria-hidden="true"></span>${tier}`;
}

function loadSection(): string {
  const groups = [...new Set(PRESETS.map((p) => p.group))];
  const ex = groups
    .map(
      (g) =>
        `<optgroup label="${esc(g)}">${PRESETS.filter((p) => p.group === g)
          .map((p) => `<option value="preset:${p.id}">${esc(p.name)}</option>`)
          .join('')}</optgroup>`,
    )
    .join('');
  const saved = Object.keys(loadBlueprints());
  const mine = saved.map((n) => `<option value="saved:${esc(n)}">${esc(n)}</option>`).join('');
  return `
    <select id="load" aria-label="Load a sample build">
      <option value="">Load a sample build…</option>${ex}${mine ? `<optgroup label="Your saved builds">${mine}</optgroup>` : ''}
    </select>
    <form id="save-form" class="row">
      <input id="bp-name" type="text" placeholder="Name this build" aria-label="Build name" maxlength="40" />
      <button type="submit" class="ghost">Save build</button>
    </form>`;
}

function formsSection(s: LabState): string {
  const cur = s.shot.stats.form;
  const btns = FORMS.map(
    (f) =>
      `<button class="form-btn ${f.id === cur.id ? 'on' : ''}" data-form="${f.id}" aria-pressed="${f.id === cur.id}">
        <b>${esc(f.name)}</b><small>${f.hiltSockets + f.shaftMax + f.tipSockets} sockets</small></button>`,
  ).join('');
  return `<div class="forms" role="group" aria-label="Wand form">${btns}</div><p class="form-text">${esc(cur.text)}</p>`;
}

function socketHtml(s: LabState, i: number): string {
  const slot = s.build.spine[i];
  const zone = zoneOf(s.shot.stats, i);
  const title = slot
    ? `${crystal(slot.id).name} (${QUALITIES.find((q) => q.id === slot.quality)?.name}) in the ${zone}. Drag it to another socket, or drag it off the wand to remove it.`
    : `Empty ${zone} socket. Drag a crystal here.`;
  return `<div role="button" tabindex="0" class="socket ${slot ? 'filled' : ''}" data-socket="${i}" title="${esc(title)}"
    aria-label="${zone} socket ${i + 1}: ${slot ? esc(crystal(slot.id).name) : 'empty'}">${slot ? gem(slot.id, slot.quality) : `<span class="socket-num">${i + 1}</span>`}</div>`;
}

function flankHtml(s: LabState, g: number): string {
  if (s.shot.stats.maxFlanks === 0 || g >= s.shot.stats.sockets - 1) return '';
  const slot = s.build.flanks[g];
  const title = slot
    ? `Side slot: ${crystal(slot.id).name}. Tints the sockets on both sides, and the next one at half strength. Drag it off to remove.`
    : 'Side slot: a crystal here tints the sockets on both sides, and the next one at half strength.';
  return `<div class="flank-gap"><div role="button" tabindex="0" class="flank ${slot ? 'filled' : ''}" data-flank="${g}"
    title="${esc(title)}" aria-label="Side slot ${g + 1}: ${slot ? esc(crystal(slot.id).name) : 'empty'}">${slot ? gem(slot.id, slot.quality) : ''}</div></div>`;
}

/** One zone of the wand (hilt, shaft or tip) with the sockets it holds. */
function zoneBox(s: LabState, zone: Zone): { html: string; grow: number; label: string } {
  const st = s.shot.stats;
  const f = st.form;
  if (zone !== 'shaft' && !f.parts.includes(zone)) return { html: '', grow: 0, label: '' };
  const id = s.build[zone];
  if (!id) {
    return {
      html: `<div class="zone ${zone}-zone empty" data-zone="${zone}" title="Drop a material here to fit a ${zone}."><span>Drop a ${zone}</span></div>`,
      grow: 1.4,
      label: `<span class="muted">No ${zone} yet</span>`,
    };
  }
  const m = material(id);
  const [start, end] = zoneRange(st, zone);
  let inner = '';
  for (let i = start; i < end; i++) inner += socketHtml(s, i) + flankHtml(s, i);
  const part = zone !== 'shaft' ? 'data-part="1"' : '';
  return {
    html: `<div class="zone ${zone}-zone fam-${m.family} ${f.id === 'twig' ? 'twig' : ''}" style="--c:${m.color}" data-zone="${zone}" ${part}
      title="${esc(m.name)} ${zone}: ${ZONE_ROLE[zone]}. Drop a material on it to swap it${zone !== 'shaft' ? ', or drag it off to remove it' : ''}.">${inner}</div>`,
    grow: Math.max(1, end - start),
    label: `<b>${esc(m.name)}</b> ${zone}<small>${ZONE_SHORT[zone]}</small>`,
  };
}

function wandSection(s: LabState): string {
  const st = s.shot.stats;
  const f = st.form;
  const n = st.sockets;
  const size = n > 8 ? 29 : n > 6 ? 33 : 40;
  const zones = (['hilt', 'shaft', 'tip'] as Zone[]).map((z) => ({ z, ...zoneBox(s, z) })).filter((x) => x.html);
  const shaft = material(s.build.shaft);
  const usedFlanks = Object.keys(s.build.flanks).length;

  const holdingNote = s.holding
    ? `Holding <b>${esc(crystal(s.holding).name)}</b>. Click a socket to place it. Esc puts it down.`
    : s.holdingPart
      ? `Holding <b>${esc(material(s.holdingPart).name)}</b>. Click the hilt, shaft or tip to fit it. Esc puts it down.`
      : 'Drag crystals into any socket and materials onto the wand. Drag off to remove.';

  return `
    <div class="wand ${st.maxFlanks > 0 ? 'has-flanks' : ''}" style="--s:${size}px">
      <div class="wand-body">
        ${zones.map((x) => x.html.replace('class="zone', `style="flex-grow:${x.grow}" class="zone`)).join('')}
        ${f.parts.includes('tip') ? '' : `<div class="point" style="--c:${shaft.color}"></div>`}
      </div>
      <div class="wand-labels">
        ${zones.map((x) => `<span style="flex-grow:${x.grow}">${x.label}</span>`).join('')}
        ${f.parts.includes('tip') ? '' : '<span class="point-gap"></span>'}
      </div>
    </div>
    <div class="wand-foot">
      <p class="flank-note">${n} socket${n === 1 ? '' : 's'}${st.maxFlanks > 0 ? `, side slots ${usedFlanks} of ${st.maxFlanks}` : f.flanks === 'none' ? `. ${f.name}s have no side slots` : `. A ${shaft.name} shaft has no room for side slots`}.</p>
      <button id="clear" class="ghost small">Empty sockets</button>
    </div>
    <p class="help">${holdingNote}</p>`;
}

function statsSection(s: LabState): string {
  const st = s.shot.stats;
  const cell = (name: string, v: string | number, hint: string) =>
    `<div class="stat" title="${esc(hint)}"><span class="stat-v">${v}</span><span class="stat-n">${name}</span></div>`;
  const draw = drawReport(st, s.env, false);
  const sources = draw.parts
    .sort((a, b) => b.share - a.share)
    .map((p) => `${esc(p.name)} ${pct(p.share)}${p.availability !== 1 ? ` <small>(×${p.availability.toFixed(1)} now)</small>` : ''}`)
    .join(', ');
  return `<div class="stats">
    ${cell('Potency', st.potency, 'Raw power added to every shot. Mostly from the tip.')}
    ${cell('Capacity', st.capacity, 'Size of the charge reservoir. Mostly from the hilt.')}
    ${cell('Recharge', st.recharge, 'How fast the reservoir refills. Mostly from the hilt.')}
    ${cell('Stability', st.stability, 'Heat tolerated before overloading. Mostly from the shaft.')}
    ${cell('Conductivity', st.conductivity, `Boosts keep ${pct(st.fadePerStep)} of their value per socket toward the tip. Mostly from the shaft.`)}
    ${cell('Tempo', st.tempo, 'Cast speed.')}
  </div>
  <p class="derived">Holds ${st.maxCharge} charge. Heat limit ${st.heatLimit - s.stabilityLoss}${s.stabilityLoss ? ` (cracked, −${s.stabilityLoss})` : ''}.</p>
  <p class="derived">Charge comes from: ${sources}. Standing still in this ${s.env.time === 'night' ? 'night' : 'day'}${s.env.weather !== 'clear' ? ` ${s.env.weather}` : ''}, it refills at ${pct(draw.mult)} speed.</p>`;
}

function shotSection(s: LabState): string {
  const sh = s.shot;
  const title = sh.reaction
    ? sh.reaction.name
    : sh.tags.length
      ? sh.tags.map((t) => ELEMENTS[t].name).join(' + ')
      : 'Bare arcane bolt';
  const sub = sh.reaction
    ? sh.reaction.text
    : sh.tags.length === 1
      ? crystal(sh.tags[0]).text
      : sh.tags.length
        ? 'Separate elements that did not fuse, carried together.'
        : 'Add an element crystal to give the shot a nature.';
  const facts: string[] = [];
  facts.push(`${sh.count > 1 ? `${sh.count} × ` : ''}${sh.powerEach} power`);
  if (sh.sideCopies) facts.push(`+${sh.sideCopies} side copies at ${sh.sideCopyPower}`);
  facts.push(sh.form === 'lob' ? 'lobbed' : `${sh.form}, speed ${sh.speed}`);
  if (sh.pierce) facts.push(`pierces ${sh.pierce}`);
  if (sh.bounces) facts.push(`bounces ${sh.bounces}`);
  if (sh.homing) facts.push('homing');
  if (sh.steer) facts.push('curves toward your aim');
  if (sh.magnet) facts.push('pulled toward armor');
  if (sh.mark) facts.push('marks targets');
  if (sh.aoeRadius) facts.push(`blast radius ${sh.aoeRadius.toFixed(1)}`);
  if (sh.lingerSeconds) facts.push(`zone ${sh.lingerSeconds.toFixed(1)} s`);
  if (sh.echoes) facts.push(`echo ×${sh.echoes}`);
  if (sh.replayEvery) facts.push(`every ${sh.replayEvery}th shot fires twice`);
  if (sh.seeds) facts.push(`${sh.seeds} seedlings`);
  if (sh.chainBonus) facts.push(`+${sh.chainBonus} chain jump`);
  if (sh.loops) facts.push(`${sh.loops} feedback loop${sh.loops > 1 ? 's' : ''}`);
  if (sh.siphon) facts.push(`siphons ${pct(sh.siphon)}`);
  if (sh.critChance > 0.05) facts.push(`${pct(sh.critChance)} critical chance`);
  const heatLimit = sh.stats.heatLimit - s.stabilityLoss;
  const heatClass = sh.heat > heatLimit ? 'bad' : sh.heat * 2 > heatLimit ? 'warn' : '';
  const effects = [...new Set([...sh.effects, ...sh.byproducts])].map((e) => `<span class="tag">${esc(e)}</span>`).join('');
  const warn = sh.warnings.map((w) => `<p class="warning">${esc(w)}</p>`).join('');
  return `
    <div class="shot" style="--shot:${sh.color}">
      <div class="shot-head"><span class="orb"></span><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></div>
      <p class="facts">${facts.map(esc).join(', ')}</p>
      <div class="costs">
        <span>Drain <b>${sh.drain}</b> of ${sh.stats.maxCharge}</span>
        <span class="${heatClass}">Heat <b>${sh.heat}</b> per shot, limit ${heatLimit}</span>
      </div>
      ${effects ? `<div class="tags">${effects}</div>` : ''}
      ${warn}
      <details class="trace"><summary>Packet trace</summary><ol>${sh.trace.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></details>
    </div>`;
}

function harmonyOf(m: Material) {
  const harmony: string[] = [];
  const clash: string[] = [];
  (Object.keys(ELEMENTS) as ElementId[]).forEach((el) => {
    if (ELEMENTS[el].harmony.includes(m.id)) harmony.push(ELEMENTS[el].name);
    if (ELEMENTS[el].clash.includes(m.id)) clash.push(ELEMENTS[el].name);
  });
  return { harmony, clash };
}

/** What a material does as a hilt, a shaft and a tip. */
export function partCard(m: Material, s: LabState): string {
  const f = s.shot.stats.form;
  const fittedAs = (['hilt', 'shaft', 'tip'] as Zone[]).filter((z) => s.build[z] === m.id && (z === 'shaft' || f.parts.includes(z)));
  const draw = Object.entries(m.drawMix)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${DRAW_SOURCES[k] ?? k} ${pct(v)}`)
    .join(', ');
  const { harmony, clash } = harmonyOf(m);
  const bite = Object.entries(m.bite);
  const biteText = bite.length ? `Hits hardest: ${bite.map(([k, v]) => `${k} ×${v}`).join(', ')}.` : 'No special bite.';
  const speed = m.velocity ?? { wood: 1, metal: 1.1, stone: 0.85, bone: 1.05, crystal: 1, exotic: 1 }[m.family];
  const role = (zone: Zone, heading: string, facts: string, perk: string, lab = true) => {
    const can = zone === 'shaft' || f.parts.includes(zone);
    const here = fittedAs.includes(zone);
    return `<div class="role ${here ? 'here' : ''}">
      <div class="role-head"><b>${heading}</b>${here ? '<span class="pill">fitted</span>' : ''}
        <button class="ghost small" data-fit="${zone}" data-mat="${m.id}" ${can ? '' : 'disabled'} title="${can ? `Fit ${m.name} as the ${zone}` : `${f.name}s have no ${zone}`}">Use as ${zone}</button></div>
      <p>${facts}</p>
      <p class="perk">${esc(perk)}${lab ? '' : ' <span class="muted">(not in the lab yet)</span>'}</p>
    </div>`;
  };
  return `<div class="part-card" style="--c:${m.color}">
    <div class="pc-head"><span class="swatch fam-${m.family}" style="--c:${m.color}"></span><div><h3>${esc(m.name)}</h3><small>${FAMILY_NAMES[m.family].replace(/s$/, '')}</small></div></div>
    ${role('hilt', 'As a hilt', `Charges from ${esc(draw)}. Capacity ${m.C}, recharge ${m.R}.`, m.hilt.perk)}
    ${role('shaft', 'As a shaft', `${m.sockets} sockets, flanks ${pct(m.flankChance)} per gap. Stability ${m.S}, conductivity ${m.Cn}.${harmony.length ? ` Harmony: ${harmony.join(', ')}.` : ''}${clash.length ? ` Clash: ${clash.join(', ')}.` : ''}`, m.shaft.perk, m.shaft.lab !== false)}
    ${role('tip', 'As a tip', `Potency ${m.P}, shot speed ×${speed}. ${esc(biteText)}`, m.tip.perk)}
  </div>`;
}

function partsSection(s: LabState): string {
  const fams = Object.keys(FAMILY_NAMES) as Family[];
  return fams
    .map((fam) => {
      const tiles = MATERIALS.filter((m) => m.family === fam)
        .map((m) => {
          const fittedZones = (['hilt', 'shaft', 'tip'] as Zone[]).filter((z) => s.build[z] === m.id);
          const fitted = fittedZones.length === 3 ? ['whole wand'] : fittedZones.map((z) => ZONE_NAMES[z]);
          return `<div role="button" tabindex="0" class="mat ${s.holdingPart === m.id ? 'held' : ''} ${state.inspect === m.id ? 'inspected' : ''}" data-material="${m.id}"
            aria-pressed="${s.holdingPart === m.id}" title="${esc(m.name)}: drag onto the hilt, shaft or tip, or click to see what it does">
            <span class="swatch fam-${m.family}" style="--c:${m.color}"></span><span class="mat-name">${esc(m.name)}</span>
            ${fitted.length ? `<span class="fitted">${fitted.join(', ')}</span>` : ''}</div>`;
        })
        .join('');
      return `<div class="group"><h3>${FAMILY_NAMES[fam]}</h3><div class="mats">${tiles}</div></div>`;
    })
    .join('');
}

function crystalsSection(s: LabState): string {
  const groups = GROUPS.map((g) => {
    const chips = CRYSTALS.filter((c) => c.group === g)
      .map(
        (c) =>
          `<div role="button" tabindex="0" class="chip ${s.holding === c.id ? 'held' : ''}" data-crystal="${c.id}" title="${esc(c.text)}" aria-pressed="${s.holding === c.id}">
            ${gem(c.id)}<span>${esc(c.name)}</span></div>`,
      )
      .join('');
    return `<div class="group"><h3>${g}</h3><div class="chips">${chips}</div></div>`;
  }).join('');
  const qualities = QUALITIES.map(
    (q) => `<button class="q ${s.quality === q.id ? 'on' : ''}" data-quality="${q.id}" aria-pressed="${s.quality === q.id}">${q.name}</button>`,
  ).join('');
  return `<div class="quality" role="group" aria-label="Crystal quality for new crystals">${qualities}</div>${groups}`;
}

function inspected(s: LabState): Material {
  return material(s.inspect ?? s.holdingPart ?? s.build.shaft);
}

export function renderBench(root: HTMLElement, s: LabState) {
  const set = (sel: string, html: string) => {
    const el = root.querySelector(sel);
    if (el) el.innerHTML = html;
  };
  const loadEl = root.querySelector('#b-load');
  // keep a half-typed build name
  if (loadEl && !loadEl.contains(document.activeElement)) set('#b-load', loadSection());
  set('#b-forms', formsSection(s));
  set('#b-wand', wandSection(s));
  set('#b-stats', statsSection(s));
  set('#b-shot', shotSection(s));
  set('#b-partcard', partCard(inspected(s), s));
  set('#b-parts', partsSection(s));
  set('#b-crystals', crystalsSection(s));
  if (view && (s.build !== lastViewBuild || s.shot.color !== lastViewColor)) {
    lastViewBuild = s.build;
    lastViewColor = s.shot.color;
    view.update(s.build, s.shot);
  }
}

// ---------- editing ----------
function edit(fn: (b: WandBuild) => void) {
  const b: WandBuild = { ...state.build, spine: [...state.build.spine], flanks: { ...state.build.flanks } };
  fn(b);
  setBuild(b, true);
}

function fitPart(zone: Zone, matId: string) {
  const f = state.shot.stats.form;
  if (zone !== 'shaft' && !f.parts.includes(zone)) {
    toast(`${f.name}s have no ${zone}. Pick a bigger wand form first.`);
    return;
  }
  state.holdingPart = null;
  state.inspect = matId;
  edit((b) => {
    b[zone] = matId;
  });
  toast(`${material(matId).name} fitted as the ${zone}.`);
}

function removePart(zone: 'hilt' | 'tip') {
  edit((b) => {
    b[zone] = null;
  });
}

function placeCrystal(target: { socket?: number; flank?: number }, crystalId: string | null, quality = state.quality) {
  if (target.flank !== undefined && crystalId) {
    const g = target.flank;
    const max = state.shot.stats.maxFlanks;
    if (!state.build.flanks[g] && Object.keys(state.build.flanks).length >= max) {
      toast(max === 0 ? 'This wand has no side slots.' : `This wand only has room for ${max} side-slot crystal${max === 1 ? '' : 's'}.`);
      return;
    }
  }
  edit((b) => {
    if (target.socket !== undefined) b.spine[target.socket] = crystalId ? { id: crystalId, quality } : null;
    else if (target.flank !== undefined) {
      if (crystalId) b.flanks[target.flank] = { id: crystalId, quality };
      else delete b.flanks[target.flank];
    }
  });
}

/** Move or swap crystals between sockets and flanks. */
function moveCrystal(from: { socket?: number; flank?: number }, to: { socket?: number; flank?: number }) {
  const get = (b: WandBuild, t: typeof from) => (t.socket !== undefined ? b.spine[t.socket] : t.flank !== undefined ? b.flanks[t.flank] ?? null : null);
  const put = (b: WandBuild, t: typeof from, v: WandBuild['spine'][number]) => {
    if (t.socket !== undefined) b.spine[t.socket] = v;
    else if (t.flank !== undefined) {
      if (v) b.flanks[t.flank] = v;
      else delete b.flanks[t.flank];
    }
  };
  if (to.flank !== undefined && !get(state.build, to) && from.flank === undefined) {
    const max = state.shot.stats.maxFlanks;
    if (Object.keys(state.build.flanks).length >= max) {
      toast(max === 0 ? 'This wand has no side slots.' : `This wand only has room for ${max} side-slot crystal${max === 1 ? '' : 's'}.`);
      return;
    }
  }
  edit((b) => {
    const a = get(b, from);
    const c = get(b, to);
    put(b, to, a);
    put(b, from, c);
  });
}

// ---------- drag and drop ----------
// Pointer-based: a ghost follows the cursor (or finger), works the same for mouse, pen and touch,
// and never fights the browser's own drag-and-drop. A press without movement is still a click.
type Source = { kind: 'crystal' | 'material' | 'socket' | 'flank' | 'part'; id: string };
type Target = { socket?: number; flank?: number; zone?: Zone };

interface DragState {
  src: Source;
  x0: number;
  y0: number;
  pointerId: number;
  active: boolean;
  ghost: HTMLElement | null;
  over: Element | null;
}

let drag: DragState | null = null;
let suppressClick = false;

function elOf(t: EventTarget | null): HTMLElement | null {
  if (t instanceof HTMLElement) return t;
  if (t instanceof Node) return t.parentElement;
  return null;
}

function sourceOf(el: HTMLElement): Source | null {
  const sock = el.closest<HTMLElement>('[data-socket].filled');
  if (sock) return { kind: 'socket', id: sock.dataset.socket! };
  const flank = el.closest<HTMLElement>('[data-flank].filled');
  if (flank) return { kind: 'flank', id: flank.dataset.flank! };
  const chip = el.closest<HTMLElement>('[data-crystal]');
  if (chip) return { kind: 'crystal', id: chip.dataset.crystal! };
  const mat = el.closest<HTMLElement>('[data-material]');
  if (mat) return { kind: 'material', id: mat.dataset.material! };
  if (el.closest('[data-socket],[data-flank]')) return null; // an empty socket
  const part = el.closest<HTMLElement>('[data-part]');
  if (part) return { kind: 'part', id: part.dataset.zone! };
  return null;
}

function targetOf(el: Element | null): Target | null {
  if (!el) return null;
  const s = el.closest<HTMLElement>('[data-socket]');
  const z = el.closest<HTMLElement>('[data-zone]');
  const zone = z ? (z.dataset.zone as Zone) : undefined;
  if (s) return { socket: Number(s.dataset.socket), zone };
  const f = el.closest<HTMLElement>('[data-flank]');
  if (f) return { flank: Number(f.dataset.flank), zone };
  if (zone) return { zone };
  return null;
}

function accepts(src: Source, t: Target | null): boolean {
  if (!t) return false;
  if (src.kind === 'crystal' || src.kind === 'socket' || src.kind === 'flank') return t.socket !== undefined || t.flank !== undefined;
  return t.zone !== undefined; // materials and parts go onto a zone (a socket counts as its zone)
}

function ghostFor(src: Source): HTMLElement {
  const g = document.createElement('div');
  g.className = 'drag-ghost';
  if (src.kind === 'crystal') g.innerHTML = gem(src.id) + `<span>${esc(crystal(src.id).name)}</span>`;
  else if (src.kind === 'socket' || src.kind === 'flank') {
    const slot = src.kind === 'socket' ? state.build.spine[Number(src.id)] : state.build.flanks[Number(src.id)];
    if (slot) g.innerHTML = gem(slot.id, slot.quality) + `<span>${esc(crystal(slot.id).name)}</span>`;
  } else {
    const id = src.kind === 'material' ? src.id : state.build[src.id as Zone];
    if (id) {
      const m = material(id);
      g.innerHTML = `<span class="swatch fam-${m.family}" style="--c:${m.color}"></span><span>${esc(m.name)}</span>`;
    }
  }
  document.body.appendChild(g);
  return g;
}

function moveGhost(x: number, y: number) {
  if (!drag?.ghost) return;
  drag.ghost.style.transform = `translate(${x + 12}px, ${y + 10}px)`;
}

function hitTest(x: number, y: number): Element | null {
  return document.elementFromPoint(x, y);
}

function endDrag() {
  if (drag?.ghost) drag.ghost.remove();
  document.body.classList.remove('dragging', 'dragging-crystal', 'dragging-material', 'dragging-socket', 'dragging-flank', 'dragging-part');
  document.querySelectorAll('.drop-over').forEach((x) => x.classList.remove('drop-over'));
  drag = null;
}

function onWand(el: Element | null): boolean {
  return !!el?.closest('.wand-body');
}

function dropOn(src: Source, t: Target | null, el: Element | null) {
  const fromWand = src.kind === 'socket' || src.kind === 'flank' || src.kind === 'part';
  if (!t || !accepts(src, t)) {
    // dragged off the wand: take it off
    if (fromWand && !onWand(el)) {
      if (src.kind === 'socket') placeCrystal({ socket: Number(src.id) }, null);
      else if (src.kind === 'flank') placeCrystal({ flank: Number(src.id) }, null);
      else removePart(src.id as 'hilt' | 'tip');
    }
    return;
  }
  if (src.kind === 'crystal') placeCrystal(t, src.id);
  else if (src.kind === 'socket') moveCrystal({ socket: Number(src.id) }, t);
  else if (src.kind === 'flank') moveCrystal({ flank: Number(src.id) }, t);
  else if (src.kind === 'material') fitPart(t.zone!, src.id);
  else if (src.kind === 'part') {
    const from = src.id as 'hilt' | 'tip';
    const to = t.zone!;
    const mat = state.build[from];
    if (mat && to !== from) {
      if (to !== 'shaft') edit((b) => (b[from] = null));
      fitPart(to, mat);
    }
  }
}

function wireDrag(root: HTMLElement) {
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const el = elOf(e.target);
    if (!el || el.closest('input, select, button:not([role])')) return;
    const src = sourceOf(el);
    if (!src) return;
    drag = { src, x0: e.clientX, y0: e.clientY, pointerId: e.pointerId, active: false, ghost: null, over: null };
    if (e.pointerType === 'mouse') e.preventDefault(); // no text selection while dragging
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.active = true;
      drag.ghost = ghostFor(drag.src);
      document.body.classList.add('dragging', `dragging-${drag.src.kind}`);
      if (drag.src.kind === 'material') state.inspect = drag.src.id;
    }
    moveGhost(e.clientX, e.clientY);
    const el = hitTest(e.clientX, e.clientY);
    const t = targetOf(el);
    const over = accepts(drag.src, t) ? el?.closest('[data-socket],[data-flank],[data-zone]') ?? null : null;
    if (over !== drag.over) {
      drag.over?.classList.remove('drop-over');
      over?.classList.add('drop-over');
      drag.over = over;
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) {
      const el = hitTest(e.clientX, e.clientY);
      const src = drag.src;
      endDrag();
      suppressClick = true;
      window.setTimeout(() => (suppressClick = false), 0);
      dropOn(src, targetOf(el), el);
    } else {
      drag = null; // a plain press: the click handler does the rest
    }
  });

  document.addEventListener('pointercancel', () => endDrag());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drag?.active) endDrag();
  });
  // swallow the click that follows a drag
  root.addEventListener('click', (e) => {
    if (suppressClick) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

export function wireBench(root: HTMLElement) {
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLSelectElement && t.id === 'load' && t.value) {
      const [kind, id] = t.value.split(/:(.*)/s);
      if (kind === 'preset') {
        const p = PRESETS.find((x) => x.id === id);
        if (p) {
          state.inspect = null;
          setBuild(buildFromPreset(p, state.quality));
          toast(p.note ? `${p.name}: ${p.note}` : `Loaded ${p.name}.`, 'info', 4200);
        }
      } else {
        const saved = loadBlueprints()[id];
        if (saved) {
          setBuild(saved);
          toast(`Loaded ${id}.`);
        }
      }
      t.value = '';
    }
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = root.querySelector<HTMLInputElement>('#bp-name');
    const name = input?.value.trim();
    if (!name) {
      toast('Type a name for the build first.');
      return;
    }
    toast(saveBlueprint(name, state.build) ? `Saved ${name}.` : 'This browser blocked saving. The build still works here.');
    if (input) input.value = '';
    input?.blur();
    emit();
  });

  root.addEventListener('click', (e) => {
    const el = elOf(e.target);
    if (!el) return;
    const btn = el.closest<HTMLElement>('button, [role="button"]');
    if (btn?.dataset.form) {
      edit((b) => {
        b.form = btn.dataset.form as WandBuild['form'];
      });
      const st = state.shot.stats;
      const missing = (['hilt', 'tip'] as const).filter((z) => st.form.parts.includes(z) && !state.build[z]);
      if (missing.length) toast(`${st.form.name}: drop a ${missing.join(' and a ')} onto the wand.`);
      return;
    }
    if (btn?.dataset.fit && btn.dataset.mat) {
      fitPart(btn.dataset.fit as Zone, btn.dataset.mat);
      return;
    }
    if (btn?.dataset.crystal) {
      state.holding = state.holding === btn.dataset.crystal ? null : btn.dataset.crystal;
      state.holdingPart = null;
      emit();
      return;
    }
    if (btn?.dataset.material) {
      const id = btn.dataset.material;
      state.holdingPart = state.holdingPart === id ? null : id;
      state.inspect = id;
      state.holding = null;
      emit();
      return;
    }
    if (btn?.dataset.quality) {
      state.quality = btn.dataset.quality;
      emit();
      return;
    }
    if (btn?.id === 'clear') {
      edit((b) => {
        b.spine = b.spine.map(() => null);
        b.flanks = {};
      });
      return;
    }
    const t = targetOf(el);
    if (!t) return;
    if (t.socket !== undefined || t.flank !== undefined) {
      if (state.holding) placeCrystal(t, state.holding);
      else if (state.holdingPart) fitPart(t.zone ?? 'shaft', state.holdingPart);
      else placeCrystal(t, null);
      return;
    }
    if (t.zone) {
      if (state.holdingPart) fitPart(t.zone, state.holdingPart);
      else {
        const id = state.build[t.zone];
        if (id) {
          state.inspect = id;
          emit();
        }
      }
    }
  });

  wireDrag(root);

  // tiles, chips and sockets are div buttons: make Enter and Space click them
  root.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && el.getAttribute('role') === 'button') {
      e.preventDefault();
      el.click();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (state.holding || state.holdingPart)) {
      state.holding = null;
      state.holdingPart = null;
      emit();
    }
  });
}
