// Lab state: the wand on the bench, the range conditions and the sandbox settings.
// Anything that changes calls emit(), and the bench, HUD and range redraw from the new state.
import { DUMMIES } from '../engine/data';
import { preset } from '../engine/presets';
import { Shot, resolveShot } from '../engine/resolve';
import { DEFAULT_ENV, Env, WandBuild, emptyBuild, refit } from '../engine/wand';

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

// A new wandwright starts the tutorial with a bare, empty Chalk twig; anyone who has finished it gets a sample.
function tutorialDone(): boolean {
  try {
    return Number(localStorage.getItem('wandgraft.tutorial.v1') ?? '0') >= 11;
  } catch {
    return false;
  }
}
const startBuild = tutorialDone() ? preset('spark') : emptyBuild('twig', null, 'chalk', null);

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

/**
 * Replace the wand (fitted to its form) and re-resolve its shot. keepZones: the build is an
 * edit of the current wand, so crystals stay in their hilt, shaft or tip zone if the zones resize.
 */
export function setBuild(build: WandBuild, keepZones = false) {
  state.build = refit(build, keepZones ? state.build : undefined);
  state.shot = resolveShot(state.build, state.env);
  state.stabilityLoss = 0;
  emit();
}

export function setEnv(env: Partial<Env>) {
  state.env = { ...state.env, ...env };
  state.shot = resolveShot(state.build, state.env);
  emit();
}

// ---- Range events (hits, breaks, overloads) for the tutorial ----
export type LabEvent =
  | { type: 'hit'; dummy: string; amount: number; tags: string[] }
  | { type: 'shell'; dummy: string }
  | { type: 'break'; dummy: string }
  | { type: 'overload'; kind: string };

const eventListeners: ((e: LabEvent) => void)[] = [];
export function onLabEvent(fn: (e: LabEvent) => void) {
  eventListeners.push(fn);
}
export function signal(e: LabEvent) {
  for (const fn of eventListeners) fn(e);
}

// ---- Saved builds (per browser; the lab works fine if storage is unavailable) ----
const KEY = 'wandgraft.blueprints.v3';

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
