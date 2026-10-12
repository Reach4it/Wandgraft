// The wand bench: parts, sockets, crystal palette and the full shot readout.
import { CRYSTALS, Family, MATERIALS, PRESETS, QUALITIES, crystal, material } from '../engine/data';
import { buildFromPreset } from '../engine/presets';
import { WandBuild, wandStats } from '../engine/wand';
import { LabState, emit, loadBlueprints, saveBlueprint, setBuild, state } from './state';
import { toast } from './toast';

const FAMILY_NAMES: Record<Family, string> = {
  wood: 'Woods',
  metal: 'Metals',
  stone: 'Stone',
  bone: 'Bone',
  crystal: 'Crystal bodies',
  exotic: 'Exotics',
};

const FAMILY_TONE: Record<Family, string> = {
  wood: '#8a6440',
  metal: '#9aa4ae',
  stone: '#6c6763',
  bone: '#d8cdb4',
  crystal: '#b5a3e6',
  exotic: '#5fa892',
};

const GROUPS = ['Elements', 'Power', 'Count', 'Form', 'Size', 'Economy', 'Meta'];

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function materialOptions(selected: string): string {
  const fams = Object.keys(FAMILY_NAMES) as Family[];
  return fams
    .map((f) => {
      const opts = MATERIALS.filter((m) => m.family === f)
        .map((m) => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}</option>`)
        .join('');
      return `<optgroup label="${FAMILY_NAMES[f]}">${opts}</optgroup>`;
    })
    .join('');
}

function gem(id: string, qualityId?: string): string {
  const c = crystal(id);
  const q = qualityId ? QUALITIES.find((x) => x.id === qualityId) : undefined;
  const tier = q && q.id !== 'clear' ? `<span class="tier">${q.name[0]}</span>` : '';
  return `<span class="gem" style="--gem:${c.color}" aria-hidden="true"></span>${tier}`;
}

function wandBar(s: LabState): string {
  const b = s.build;
  const stats = s.shot.stats;
  const tone = (id: string) => FAMILY_TONE[material(id).family];
  const n = stats.sockets;
  const usedFlanks = Object.keys(b.flanks).length;
  const sockets = Array.from({ length: n }, (_, i) => {
    const slot = b.spine[i];
    const title = slot ? `${crystal(slot.id).name} (${QUALITIES.find((q) => q.id === slot.quality)?.name}). Click to remove.` : 'Empty socket. Pick a crystal, then click here.';
    return `<button class="socket ${slot ? 'filled' : ''}" data-socket="${i}" title="${esc(title)}" aria-label="Socket ${i + 1}: ${slot ? esc(crystal(slot.id).name) : 'empty'}">
      ${slot ? gem(slot.id, slot.quality) : `<span class="socket-num">${i + 1}</span>`}
    </button>`;
  }).join('');

  const flanks =
    stats.maxFlanks > 0
      ? Array.from({ length: n - 1 }, (_, g) => {
          const slot = b.flanks[g];
          const left = ((g + 1) / n) * 100;
          const title = slot ? `Flank: ${crystal(slot.id).name}. Click to remove.` : 'Flank socket between two spine sockets.';
          return `<button class="flank ${slot ? 'filled' : ''}" style="left:${left}%" data-flank="${g}" title="${esc(title)}" aria-label="Flank ${g + 1}: ${slot ? esc(crystal(slot.id).name) : 'empty'}">
            ${slot ? gem(slot.id, slot.quality) : ''}
          </button>`;
        }).join('')
      : '';

  return `
    <div class="wand" style="--grip:${tone(b.grip)};--shaft:${tone(b.shaft)};--cap:${tone(b.cap)}">
      <div class="flank-row">${flanks}</div>
      <div class="wand-body">
        <span class="grip-seg"></span>
        <div class="sockets" style="--n:${n}">${sockets}</div>
        <span class="cap-seg"></span>
      </div>
      <div class="wand-ends"><span>Handle</span><span>${stats.maxFlanks > 0 ? `Flanks ${usedFlanks} of ${stats.maxFlanks}` : 'No flank sockets on this shaft'}</span><span>Tip</span></div>
    </div>`;
}

function statsGrid(s: LabState): string {
  const st = s.shot.stats;
  const cell = (name: string, v: string | number, hint: string) =>
    `<div class="stat" title="${esc(hint)}"><span class="stat-v">${v}</span><span class="stat-n">${name}</span></div>`;
  return `<div class="stats">
    ${cell('Potency', st.potency, 'Raw power added to every shot (mostly from the cap)')}
    ${cell('Capacity', st.capacity, 'Size of the charge reservoir (mostly from the grip)')}
    ${cell('Recharge', st.recharge, 'How fast the reservoir refills (mostly from the grip)')}
    ${cell('Stability', st.stability, 'Heat tolerated before overloading (mostly from the shaft)')}
    ${cell('Conductivity', st.conductivity, `Boosts keep ${Math.round(st.fadePerStep * 100)}% of their value per socket toward the tip`)}
    ${cell('Tempo', st.tempo, 'Cast speed')}
  </div>
  <p class="derived">Holds ${st.maxCharge} charge and refills ${st.chargePerSecond} per second. Heat limit ${st.heatLimit - s.stabilityLoss}${s.stabilityLoss ? ` (cracked, −${s.stabilityLoss})` : ''}.</p>`;
}

function palette(s: LabState): string {
  const groups = GROUPS.map((g) => {
    const chips = CRYSTALS.filter((c) => c.group === g)
      .map(
        (c) =>
          `<button class="chip ${s.holding === c.id ? 'held' : ''}" draggable="true" data-crystal="${c.id}" title="${esc(c.text)}" aria-pressed="${s.holding === c.id}">
            ${gem(c.id)}<span>${esc(c.name)}</span></button>`,
      )
      .join('');
    return `<div class="group"><h3>${g}</h3><div class="chips">${chips}</div></div>`;
  }).join('');
  const qualities = QUALITIES.map(
    (q) => `<button class="q ${s.quality === q.id ? 'on' : ''}" data-quality="${q.id}" aria-pressed="${s.quality === q.id}">${q.name}</button>`,
  ).join('');
  return `<div class="quality" role="group" aria-label="Crystal quality">${qualities}</div>${groups}`;
}

function preview(s: LabState): string {
  const sh = s.shot;
  const title = sh.reaction ? sh.reaction.name : sh.tags.length ? sh.tags.map((t) => t[0].toUpperCase() + t.slice(1)).join(' + ') : 'Bare arcane bolt';
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
  if (sh.aoeRadius) facts.push(`blast radius ${sh.aoeRadius.toFixed(1)}`);
  if (sh.lingerSeconds) facts.push(`zone ${sh.lingerSeconds.toFixed(1)} s`);
  if (sh.echoes) facts.push(`echo ×${sh.echoes}`);
  if (sh.seeds) facts.push(`${sh.seeds} seedlings`);
  if (sh.loops) facts.push(`${sh.loops} feedback loop${sh.loops > 1 ? 's' : ''}`);
  if (sh.siphon) facts.push(`siphons ${Math.round(sh.siphon * 100)}%`);
  const heatLimit = sh.stats.heatLimit - s.stabilityLoss;
  const heatClass = sh.heat > heatLimit ? 'bad' : sh.heat * 2 > heatLimit ? 'warn' : '';
  const effects = [...sh.effects, ...sh.byproducts].map((e) => `<span class="tag">${esc(e)}</span>`).join('');
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

function blueprintOptions(): string {
  const saved = Object.keys(loadBlueprints());
  const ex = PRESETS.map((p) => `<option value="preset:${p.id}">${esc(p.name)}</option>`).join('');
  const mine = saved.map((n) => `<option value="saved:${esc(n)}">${esc(n)}</option>`).join('');
  return `<option value="">Load a build…</option><optgroup label="Examples from the design doc">${ex}</optgroup>${mine ? `<optgroup label="Your saved builds">${mine}</optgroup>` : ''}`;
}

export function renderBench(root: HTMLElement, s: LabState) {
  const b = s.build;
  root.innerHTML = `
    <header class="bench-head">
      <h1>Wand Lab</h1>
      <p>Graft a wand, socket crystals, and test it on the range. Everything here is a free practice copy.</p>
    </header>
    <section class="block">
      <select id="load" aria-label="Load a build">${blueprintOptions()}</select>
      <form id="save-form" class="row">
        <input id="bp-name" type="text" placeholder="Name this build" aria-label="Build name" maxlength="40" />
        <button type="submit" class="ghost">Save build</button>
      </form>
    </section>
    <section class="block">
      <h2 class="block-title">Parts</h2>
      <div class="parts">
        <label>Grip<select data-part="grip">${materialOptions(b.grip)}</select></label>
        <label>Shaft<select data-part="shaft">${materialOptions(b.shaft)}</select></label>
        <label>Cap<select data-part="cap">${materialOptions(b.cap)}</select></label>
      </div>
      <p class="quirk"><b>${esc(material(b.shaft).name)} shaft:</b> ${esc(material(b.shaft).quirk)}</p>
      ${statsGrid(s)}
    </section>
    <section class="block">
      <h2 class="block-title">Sockets</h2>
      ${wandBar(s)}
      <p class="help">${s.holding ? `Holding <b>${esc(crystal(s.holding).name)}</b>. Click a socket to place it, or Esc to put it down.` : 'Pick a crystal below, then click a socket. Click a filled socket to empty it. You can also drag crystals onto sockets.'}</p>
      <button id="clear" class="ghost small">Empty all sockets</button>
    </section>
    <section class="block">${preview(s)}</section>
    <section class="block">
      <h2 class="block-title">Crystals</h2>
      ${palette(s)}
    </section>`;
}

function resize(build: WandBuild, shaft: string): WandBuild {
  const n = material(shaft).sockets;
  const spine = Array.from({ length: n }, (_, i) => build.spine[i] ?? null);
  const max = wandStats({ ...build, shaft }).maxFlanks;
  const flanks: WandBuild['flanks'] = {};
  Object.entries(build.flanks)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([g]) => g < n - 1)
    .slice(0, max)
    .forEach(([g, v]) => (flanks[g] = v));
  return { ...build, shaft, spine, flanks };
}

function place(target: { socket?: number; flank?: number }, crystalId: string | null) {
  const b: WandBuild = { ...state.build, spine: [...state.build.spine], flanks: { ...state.build.flanks } };
  if (target.socket !== undefined) {
    b.spine[target.socket] = crystalId ? { id: crystalId, quality: state.quality } : null;
  } else if (target.flank !== undefined) {
    const g = target.flank;
    if (!crystalId) delete b.flanks[g];
    else {
      const max = state.shot.stats.maxFlanks;
      if (!b.flanks[g] && Object.keys(b.flanks).length >= max) {
        toast(`${material(b.shaft).name} only has room for ${max} flank crystal${max === 1 ? '' : 's'}.`);
        return;
      }
      b.flanks[g] = { id: crystalId, quality: state.quality };
    }
  }
  setBuild(b);
}

export function wireBench(root: HTMLElement) {
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLSelectElement && t.dataset.part) {
      const part = t.dataset.part as 'grip' | 'shaft' | 'cap';
      const b = part === 'shaft' ? resize(state.build, t.value) : { ...state.build, [part]: t.value };
      setBuild(b);
    } else if (t instanceof HTMLSelectElement && t.id === 'load' && t.value) {
      const [kind, id] = t.value.split(/:(.*)/s);
      if (kind === 'preset') {
        const p = PRESETS.find((x) => x.id === id);
        if (p) {
          setBuild(buildFromPreset(p, state.quality));
          toast(`Loaded ${p.name}.`);
        }
      } else {
        const saved = loadBlueprints()[id];
        if (saved) {
          setBuild(saved);
          toast(`Loaded ${id}.`);
        }
      }
    }
  });

  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    if (el.dataset.crystal) {
      state.holding = state.holding === el.dataset.crystal ? null : el.dataset.crystal;
      emit();
    } else if (el.dataset.quality) {
      state.quality = el.dataset.quality;
      emit();
    } else if (el.dataset.socket !== undefined) {
      const i = Number(el.dataset.socket);
      place({ socket: i }, state.holding ?? null);
    } else if (el.dataset.flank !== undefined) {
      const g = Number(el.dataset.flank);
      place({ flank: g }, state.holding ?? null);
    } else if (el.id === 'clear') {
      setBuild({ ...state.build, spine: state.build.spine.map(() => null), flanks: {} });
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
    emit();
  });

  root.addEventListener('dragstart', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-crystal]');
    if (el && e.dataTransfer) {
      e.dataTransfer.setData('text/plain', el.dataset.crystal!);
      e.dataTransfer.effectAllowed = 'copy';
    }
  });
  root.addEventListener('dragover', (e) => {
    if ((e.target as HTMLElement).closest('[data-socket],[data-flank]')) e.preventDefault();
  });
  root.addEventListener('drop', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-socket],[data-flank]');
    const id = e.dataTransfer?.getData('text/plain');
    if (!el || !id) return;
    e.preventDefault();
    if (el.dataset.socket !== undefined) place({ socket: Number(el.dataset.socket) }, id);
    else place({ flank: Number(el.dataset.flank) }, id);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.holding) {
      state.holding = null;
      emit();
    }
  });
}
