// Lab state: the wand on the bench and the sandbox settings. Anything that changes
// calls emit(), and the bench, HUD and range redraw from the new state.
import { DUMMIES } from '../engine/data';
import { preset } from '../engine/presets';
import { Shot, resolveShot } from '../engine/resolve';
import { WandBuild } from '../engine/wand';

export interface Sandbox {
  infiniteCharge: boolean;
  overloads: boolean;
  timeScale: number;
  dummies: Record<string, boolean>;
  moving: boolean;
}

export interface LabState {
  build: WandBuild;
  shot: Shot;
  quality: string;
  /** Crystal picked up from the palette, waiting to be placed. */
  holding: string | null;
  sandbox: Sandbox;
  stabilityLoss: number;
}

type Listener = (s: LabState) => void;
const listeners: Listener[] = [];

const startBuild = preset('spark');

export const state: LabState = {
  build: startBuild,
  shot: resolveShot(startBuild),
  quality: 'clear',
  holding: null,
  sandbox: {
    infiniteCharge: false,
    overloads: true,
    timeScale: 1,
    dummies: Object.fromEntries(DUMMIES.map((d) => [d.id, true])),
    moving: false,
  },
  stabilityLoss: 0,
};

export function onChange(fn: Listener) {
  listeners.push(fn);
}

export function emit() {
  for (const fn of listeners) fn(state);
}

/** Replace the wand and re-resolve its shot. */
export function setBuild(build: WandBuild) {
  state.build = build;
  state.shot = resolveShot(build);
  state.stabilityLoss = 0;
  emit();
}

// ---- Saved builds (per browser; the lab works fine if storage is unavailable) ----
const KEY = 'wandgraft.blueprints.v1';

export function loadBlueprints(): Record<string, WandBuild> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, WandBuild>) : {};
  } catch {
    return {};
  }
}

export function saveBlueprint(name: string, build: WandBuild): boolean {
  try {
    const all = loadBlueprints();
    all[name] = build;
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
