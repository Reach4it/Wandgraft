// The wand bench: wand form, the built wand (3D view plus a drag-and-drop layout of grip,
// shaft, sockets and cap), the shot readout, the parts list with what each material does
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
  crystal,
  material,
} from '../engine/data';
import { buildFromPreset } from '../engine/presets';
import { WandBuild, drawReport } from '../engine/wand';
import { LabState, emit, loadBlueprints, saveBlueprint, setBuild, state } from './state';
import { toast } from './toast';
import { WandView } from './wandModel';

type Zone = 'grip' | 'shaft' | 'cap';

const FAMILY_NAMES: Record<Family, string> = {
  wood: 'Woods',
  metal: 'Metals',
  stone: 'Stone',
  bone: 'Bone',
  crystal: 'Crystal bodies',
  exotic: 'Exotics',
};
const GROUPS = ['Elements', 'Power', 'Count', 'Form', 'Size', 'Economy', 'Meta'];
const ZONE_NAMES: Record<Zone, string> = { grip: 'grip', shaft: 'shaft', cap: 'cap' };

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const pct = (x: number) => `${Math.round(x * 100)}%`;

let view: WandView | null = null;
let lastViewBuild: WandBuild | null = null;
let lastViewColor = '';

// ---------- skeleton (built once; the 3D view canvas must survive re-renders) ----------
export function mountBench(root: HTMLElement) {
  root.innerHTML = `
    <header class="bench-head">
      <h1>Wand Lab</h1>
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
      <p class="help">Every material can be a grip, a shaft or a cap, and does something different in each. Drag one onto the wand, or pick it and use the buttons.</p>
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
        <b>${esc(f.name)}</b><small>${f.maxSockets} socket${f.maxSockets === 1 ? '' : 's'}</small></button>`,
  ).join('');
  return `<div class="forms" role="group" aria-label="Wand form">${btns}</div><p class="form-text">${esc(cur.text)}</p>`;
}

function zoneHtml(zone: 'grip' | 'cap', s: LabState): string {
  const f = s.shot.stats.form;
  if (!f.parts.includes(zone)) return '';
  const id = s.build[zone];
  if (!id) {
    return `<div class="zone ${zone}-zone empty" data-zone="${zone}" title="Drop a material here to fit a ${zone}.">
      <span>${zone === 'grip' ? 'Grip' : 'Cap'}</span></div>`;
  }
  const m = material(id);
  return `<div class="zone ${zone}-zone fam-${m.family}" style="--c:${m.color}" data-zone="${zone}" draggable="true"
    title="${esc(m.name)} ${zone}. Drag it off the wand to remove it." aria-label="${esc(m.name)} ${zone}"></div>`;
}

function wandSection(s: LabState): string {
  const b = s.build;
  const st = s.shot.stats;
  const f = st.form;
  const n = st.sockets;
  const shaft = material(b.shaft);
  const hasGrip = f.parts.includes('grip');
  const hasCap = f.parts.includes('cap');
  const gw = hasGrip ? 16 : 0;
  const cw = hasCap ? 13 : 5;
  const usedFlanks = Object.keys(b.flanks).length;

  const sockets = Array.from({ length: n }, (_, i) => {
    const slot = b.spine[i];
    const title = slot
      ? `${crystal(slot.id).name} (${QUALITIES.find((q) => q.id === slot.quality)?.name}). Drag to move, drag off to remove, or click to remove.`
      : 'Empty socket. Drag a crystal here, or pick one and click.';
    return `<div role="button" tabindex="0" class="socket ${slot ? 'filled' : ''}" data-socket="${i}" ${slot ? 'draggable="true"' : ''} title="${esc(title)}"
      aria-label="Socket ${i + 1}: ${slot ? esc(crystal(slot.id).name) : 'empty'}">${slot ? gem(slot.id, slot.quality) : `<span class="socket-num">${i + 1}</span>`}</div>`;
  }).join('');

  const flanks =
    st.maxFlanks > 0
      ? Array.from({ length: n - 1 }, (_, g) => {
          const slot = b.flanks[g];
          const left = ((g + 1) / n) * 100;
          const title = slot ? `Flank: ${crystal(slot.id).name}. Drag off or click to remove.` : 'Flank socket: tints the two sockets beside it.';
          return `<div role="button" tabindex="0" class="flank ${slot ? 'filled' : ''}" style="left:${left}%" data-flank="${g}" ${slot ? 'draggable="true"' : ''}
            title="${esc(title)}" aria-label="Flank ${g + 1}: ${slot ? esc(crystal(slot.id).name) : 'empty'}">${slot ? gem(slot.id, slot.quality) : ''}</div>`;
        }).join('')
      : '';

  const label = (zone: Zone) => {
    if (zone !== 'shaft' && !f.parts.includes(zone)) return `<span class="muted">${f.name}s have no ${zone}</span>`;
    const id = b[zone];
    return id ? `<b>${esc(material(id).name)}</b> ${zone}` : `<span class="muted">No ${zone} yet</span>`;
  };

  const holdingNote = s.holding
    ? `Holding <b>${esc(crystal(s.holding).name)}</b>. Click a socket to place it. Esc puts it down.`
    : s.holdingPart
      ? `Holding <b>${esc(material(s.holdingPart).name)}</b>. Click the grip, shaft or cap to fit it. Esc puts it down.`
      : 'Drag crystals into sockets and materials onto the wand. Drag off to remove.';

  return `
    <div class="wand" style="--gw:${gw}%;--cw:${cw}%">
      <div class="flank-row">${flanks}</div>
      <div class="wand-body">
        ${hasGrip ? zoneHtml('grip', s) : ''}
        <div class="zone shaft-zone fam-${shaft.family} ${f.id === 'twig' ? 'twig' : ''}" style="--c:${shaft.color}" data-zone="shaft"
          title="${esc(shaft.name)} shaft. Drop a material here to change it.">
          <div class="sockets" style="--n:${n}">${sockets}</div>
        </div>
        ${hasCap ? zoneHtml('cap', s) : `<div class="point" style="--c:${shaft.color}"></div>`}
      </div>
      <div class="wand-labels" style="grid-template-columns:${hasGrip ? '1fr ' : ''}2fr ${hasCap ? '1fr' : ''}">
        ${hasGrip ? `<span>${label('grip')}</span>` : ''}<span class="mid">${label('shaft')}</span>${hasCap ? `<span class="end">${label('cap')}</span>` : ''}
      </div>
    </div>
    <div class="wand-foot">
      <p class="flank-note">${st.maxFlanks > 0 ? `Flank sockets: ${usedFlanks} of ${st.maxFlanks} used.` : f.flanks === 'none' ? `${f.name}s have no flank sockets.` : `A ${shaft.name} shaft has no room for flanks.`}</p>
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
    ${cell('Potency', st.potency, 'Raw power added to every shot. Mostly from the cap.')}
    ${cell('Capacity', st.capacity, 'Size of the charge reservoir. Mostly from the grip.')}
    ${cell('Recharge', st.recharge, 'How fast the reservoir refills. Mostly from the grip.')}
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

/** What a material does as a grip, a shaft and a cap. */
export function partCard(m: Material, s: LabState): string {
  const f = s.shot.stats.form;
  const fittedAs = (['grip', 'shaft', 'cap'] as Zone[]).filter((z) => s.build[z] === m.id && (z === 'shaft' || f.parts.includes(z)));
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
    ${role('grip', 'As a grip', `Charges from ${esc(draw)}. Capacity ${m.C}, recharge ${m.R}.`, m.grip.perk)}
    ${role('shaft', 'As a shaft', `${m.sockets} sockets, flanks ${pct(m.flankChance)} per gap. Stability ${m.S}, conductivity ${m.Cn}.${harmony.length ? ` Harmony: ${harmony.join(', ')}.` : ''}${clash.length ? ` Clash: ${clash.join(', ')}.` : ''}`, m.shaft.perk, m.shaft.lab !== false)}
    ${role('cap', 'As a cap', `Potency ${m.P}, shot speed ×${speed}. ${esc(biteText)}`, m.cap.perk)}
  </div>`;
}

function partsSection(s: LabState): string {
  const fams = Object.keys(FAMILY_NAMES) as Family[];
  return fams
    .map((fam) => {
      const tiles = MATERIALS.filter((m) => m.family === fam)
        .map((m) => {
          const fittedZones = (['grip', 'shaft', 'cap'] as Zone[]).filter((z) => s.build[z] === m.id);
          const fitted = fittedZones.length === 3 ? ['whole wand'] : fittedZones.map((z) => ZONE_NAMES[z]);
          return `<div role="button" tabindex="0" class="mat ${s.holdingPart === m.id ? 'held' : ''} ${state.inspect === m.id ? 'inspected' : ''}" draggable="true" data-material="${m.id}"
            aria-pressed="${s.holdingPart === m.id}" title="${esc(m.name)}: drag onto the wand, or click to see what it does">
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
          `<div role="button" tabindex="0" class="chip ${s.holding === c.id ? 'held' : ''}" draggable="true" data-crystal="${c.id}" title="${esc(c.text)}" aria-pressed="${s.holding === c.id}">
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
  setBuild(b);
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

function removePart(zone: 'grip' | 'cap') {
  edit((b) => {
    b[zone] = null;
  });
}

function placeCrystal(target: { socket?: number; flank?: number }, crystalId: string | null, quality = state.quality) {
  if (target.flank !== undefined && crystalId) {
    const g = target.flank;
    const max = state.shot.stats.maxFlanks;
    if (!state.build.flanks[g] && Object.keys(state.build.flanks).length >= max) {
      toast(max === 0 ? 'This wand has no flank sockets.' : `This wand only has room for ${max} flank crystal${max === 1 ? '' : 's'}.`);
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
      toast(max === 0 ? 'This wand has no flank sockets.' : `This wand only has room for ${max} flank crystal${max === 1 ? '' : 's'}.`);
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

// ---------- events ----------
let dragPayload = '';
let dropped = false;

function endDrag(root: HTMLElement) {
  dragPayload = '';
  root.classList.remove('dragging', 'dragging-crystal', 'dragging-material', 'dragging-socket', 'dragging-flank', 'dragging-part');
  root.querySelectorAll('.drop-over').forEach((x) => x.classList.remove('drop-over'));
}

/** Drag events can target a text node; use its element. */
function elOf(t: EventTarget | null): HTMLElement | null {
  if (t instanceof HTMLElement) return t;
  if (t instanceof Node) return t.parentElement;
  return null;
}

function targetOf(el: Element | null): { socket?: number; flank?: number; zone?: Zone } | null {
  if (!el) return null;
  const s = el.closest<HTMLElement>('[data-socket]');
  if (s) return { socket: Number(s.dataset.socket) };
  const f = el.closest<HTMLElement>('[data-flank]');
  if (f) return { flank: Number(f.dataset.flank) };
  const z = el.closest<HTMLElement>('[data-zone]');
  if (z) return { zone: z.dataset.zone as Zone };
  return null;
}

function accepts(payload: string, t: ReturnType<typeof targetOf>): boolean {
  if (!t) return false;
  const kind = payload.split(':')[0];
  if (kind === 'crystal' || kind === 'socket' || kind === 'flank') return t.socket !== undefined || t.flank !== undefined;
  if (kind === 'material' || kind === 'part') return true; // sockets count as the shaft
  return false;
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
      const missing = (['grip', 'cap'] as const).filter((z) => st.form.parts.includes(z) && !state.build[z]);
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
      else if (state.holdingPart) fitPart('shaft', state.holdingPart);
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

  root.addEventListener('dragstart', (e) => {
    const el = elOf(e.target);
    if (!el) return;
    const chip = el.closest<HTMLElement>('[data-crystal]');
    const mat = el.closest<HTMLElement>('[data-material]');
    const sock = el.closest<HTMLElement>('[data-socket].filled');
    const flank = el.closest<HTMLElement>('[data-flank].filled');
    const zone = el.closest<HTMLElement>('[data-zone="grip"],[data-zone="cap"]');
    if (chip) dragPayload = `crystal:${chip.dataset.crystal}`;
    else if (mat) {
      dragPayload = `material:${mat.dataset.material}`;
      state.inspect = mat.dataset.material!; // shown in the part card once it's fitted
    }
    else if (sock) dragPayload = `socket:${sock.dataset.socket}`;
    else if (flank) dragPayload = `flank:${flank.dataset.flank}`;
    else if (zone && !zone.classList.contains('empty')) dragPayload = `part:${zone.dataset.zone}`;
    else return;
    dropped = false;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', dragPayload);
      e.dataTransfer.effectAllowed = 'move';
    }
    root.classList.add('dragging', `dragging-${dragPayload.split(':')[0]}`);
  });

  root.addEventListener('dragover', (e) => {
    const t = targetOf(elOf(e.target));
    if (!dragPayload || !accepts(dragPayload, t)) return;
    e.preventDefault();
    const over = elOf(e.target)?.closest('[data-socket],[data-flank],[data-zone]');
    root.querySelectorAll('.drop-over').forEach((x) => x !== over && x.classList.remove('drop-over'));
    over?.classList.add('drop-over');
  });

  root.addEventListener('drop', (e) => {
    const t = targetOf(elOf(e.target));
    if (!dragPayload || !t || !accepts(dragPayload, t)) return;
    e.preventDefault();
    dropped = true;
    const [kind, id] = dragPayload.split(':');
    if (kind === 'crystal') placeCrystal(t, id);
    else if (kind === 'socket') moveCrystal({ socket: Number(id) }, t);
    else if (kind === 'flank') moveCrystal({ flank: Number(id) }, t);
    else if (kind === 'material') fitPart(t.zone ?? 'shaft', id);
    else if (kind === 'part') {
      const from = id as 'grip' | 'cap';
      const to = t.zone ?? 'shaft';
      const mat = state.build[from];
      if (mat && to !== from) {
        if (to !== 'shaft') edit((b) => (b[from] = null));
        fitPart(to, mat);
      }
    }
    // the dragged element may have been re-rendered away, so its dragend never arrives
    endDrag(root);
  });

  root.addEventListener('dragend', () => {
    // dragged off the wand: remove it
    if (!dropped && dragPayload) {
      const [kind, id] = dragPayload.split(':');
      if (kind === 'socket') placeCrystal({ socket: Number(id) }, null);
      else if (kind === 'flank') placeCrystal({ flank: Number(id) }, null);
      else if (kind === 'part') removePart(id as 'grip' | 'cap');
    }
    endDrag(root);
  });

  // the draggable tiles are div buttons (real <button>s can't start a drag in every browser)
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
