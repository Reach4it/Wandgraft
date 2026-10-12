// Right-hand panel: dummies on the range, sandbox controls and the damage log.
import { DUMMIES } from '../engine/data';
import { LabState, emit, setEnv, state } from './state';

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function renderSide(root: HTMLElement, s: LabState) {
  let controls = root.querySelector<HTMLElement>('#side-controls');
  if (!controls) {
    root.innerHTML = `<div id="side-controls"></div>
      <section class="block log-block">
        <div class="log-head"><h2 class="block-title">Damage log</h2><button id="clear-log" class="ghost small">Clear</button></div>
        <ol id="log" aria-live="off"><li class="empty">Hits show up here: reaction, damage, and why.</li></ol>
      </section>`;
    controls = root.querySelector<HTMLElement>('#side-controls')!;
  }
  const dummies = DUMMIES.map(
    (d) => `<label class="dummy-toggle" title="${esc(d.behavior)}">
      <input type="checkbox" data-dummy="${d.id}" ${s.sandbox.dummies[d.id] ? 'checked' : ''} />
      <span class="swatch" style="--sw:${d.color}"></span>
      <span><b>${esc(d.name)}</b><small>${esc(d.tests)}</small></span>
    </label>`,
  ).join('');
  controls.innerHTML = `
    <section class="block">
      <h2 class="block-title">Test dummies</h2>
      <div class="dummies">${dummies}</div>
    </section>
    <section class="block">
      <h2 class="block-title">Time and weather</h2>
      <p class="help">Grips charge from different sources: sun, moon, rain, storms. Try a Silver cap at night.</p>
      <div class="seg" role="group" aria-label="Time of day">
        ${(['day', 'night'] as const).map((t) => `<button class="q ${s.env.time === t ? 'on' : ''}" data-time="${t}" aria-pressed="${s.env.time === t}">${t === 'day' ? 'Day' : 'Night'}</button>`).join('')}
      </div>
      <div class="seg" role="group" aria-label="Weather">
        ${(['clear', 'rain', 'storm'] as const).map((w) => `<button class="q ${s.env.weather === w ? 'on' : ''}" data-weather="${w}" aria-pressed="${s.env.weather === w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join('')}
      </div>
    </section>
    <section class="block">
      <h2 class="block-title">Sandbox</h2>
      <label class="switch"><input type="checkbox" data-sb="infiniteCharge" ${s.sandbox.infiniteCharge ? 'checked' : ''} /> Infinite charge</label>
      <label class="switch"><input type="checkbox" data-sb="overloads" ${s.sandbox.overloads ? 'checked' : ''} /> Overloads happen</label>
      <label class="slider">Time speed <output>${Math.round(s.sandbox.timeScale * 100)}%</output>
        <input type="range" min="10" max="100" step="10" value="${Math.round(s.sandbox.timeScale * 100)}" data-sb="timeScale" />
      </label>
      <button id="reset-range" class="ghost small">Reset range</button>
    </section>`;
}

export function wireSide(root: HTMLElement, onReset: () => void) {
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.dummy) {
      state.sandbox.dummies[t.dataset.dummy] = t.checked;
      emit();
    } else if (t.dataset.sb === 'infiniteCharge' || t.dataset.sb === 'overloads') {
      state.sandbox[t.dataset.sb] = t.checked;
      emit();
    }
  });
  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.sb === 'timeScale') {
      state.sandbox.timeScale = Number(t.value) / 100;
      const out = t.parentElement?.querySelector('output');
      if (out) out.textContent = `${t.value}%`;
    }
  });
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('button');
    if (!el) return;
    if (el.id === 'reset-range') onReset();
    if (el.dataset.time) setEnv({ time: el.dataset.time as 'day' | 'night' });
    if (el.dataset.weather) setEnv({ weather: el.dataset.weather as 'clear' | 'rain' | 'storm' });
    if (el.id === 'clear-log') {
      const log = root.querySelector('#log');
      if (log) log.innerHTML = '<li class="empty">Hits show up here: reaction, damage, and why.</li>';
    }
  });
}

/** Add a line to the damage log (newest first, capped). */
export function logLine(html: string, kind = '') {
  const log = document.getElementById('log');
  if (!log) return;
  log.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  if (kind) li.className = kind;
  li.innerHTML = html;
  log.prepend(li);
  while (log.children.length > 80) log.lastElementChild?.remove();
}
