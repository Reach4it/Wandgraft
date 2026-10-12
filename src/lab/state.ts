// Lab state: the wand on the bench, the range conditions and the sandbox settings.
// Anything that changes calls emit(), and the bench, HUD and range redraw from the new state.
import { DUMMIES } from '../engine/data';
import { preset } from '../engine/presets';
import { Shot, resolveShot } from '../engine/resolve';
import { DEFAULT_ENV, Env, WandBuild, refit } from '../engine/wand';

export interface Sandbox {
  infiniteCharge: boolean;
  overloads: boolean;
  timeScale: number;
  dummies: Record<string, boolean>;
}

export interface LabState {
  build: WandBuild;
  shot: Shot;
  env: Env;
  quality: string;
  /** Crystal picked up from the palette, waiting to be placed. */
  holding: string | null;
  /** Material picked up from the parts list, waiting to be fitted. */
  holdingPart: string | null;
  /** Material shown in the part card. */
  inspect: string | null;
  sandbox: Sandbox;
  stabilityLoss: number;
}

type Listener = (s: LabState) => void;
const listeners: Listener[] = [];

const startBuild = preset('spark');

export const state: LabState = {
  build: startBuild,
  shot: resolveShot(startBuild, DEFAULT_ENV),
  env: { ...DEFAULT_ENV },
  quality: 'clear',
  holding: null,
  holdingPart: null,
  inspect: null,
  sandbox: {
    infiniteCharge: false,
    overloads: true,
    timeScale: 1,
    dummies: Object.fromEntries(DUMMIES.map((d) => [d.id, true])),
  },
  stabilityLoss: 0,
};

export function onChange(fn: Listener) {
  listeners.push(fn);
}

export function emit() {
  for (const fn of listeners) fn(state);
}

/** Replace the wand (fitted to its form) and re-resolve its shot. */
export function setBuild(build: WandBuild) {
  state.build = refit(build);
  state.shot = resolveShot(state.build, state.env);
  state.stabilityLoss = 0;
  emit();
}

export function setEnv(env: Partial<Env>) {
  state.env = { ...state.env, ...env };
  state.shot = resolveShot(state.build, state.env);
  emit();
}

// ---- Saved builds (per browser; the lab works fine if storage is unavailable) ----
const KEY = 'wandgraft.blueprints.v2';

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
