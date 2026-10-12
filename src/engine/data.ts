// Typed access to the JSON game data. The JSON files are the source of truth and
// are meant to move to the final engine (Godot) unchanged.
import materialsJson from '../data/materials.json';
import elementsJson from '../data/elements.json';
import crystalsJson from '../data/crystals.json';
import dummiesJson from '../data/dummies.json';
import presetsJson from '../data/presets.json';

export type ElementId = 'fire' | 'water' | 'earth' | 'wind';
export type Family = 'wood' | 'metal' | 'stone' | 'bone' | 'crystal' | 'exotic';

export interface Material {
  id: string;
  name: string;
  family: Family;
  P: number; C: number; R: number; S: number; Cn: number;
  draw: string;
  bite: Record<string, number>;
  sockets: number;
  flankChance: number;
  velocity?: number;
  tempo?: number;
  quirk: string;
}

export interface ElementDef {
  name: string;
  color: string;
  form: string;
  vs: Record<string, number>;
  harmony: string[];
  clash: string[];
  byproduct: { id: string; name: string; effect: string };
  onHit: string[];
}

export interface Reaction {
  id: string;
  name: string;
  tags: ElementId[];
  color: string;
  effects: string[];
  text: string;
}

export interface Crystal {
  id: string;
  name: string;
  kind: 'element' | 'modifier';
  element?: ElementId;
  group: string;
  drain: number;
  heat: number;
  power?: number;
  color: string;
  text: string;
}

export interface Quality { id: string; name: string; strength: number; load: number }

export interface DummyDef {
  id: string;
  name: string;
  category: string;
  hp: number;
  shell?: number;
  ward?: number;
  regen?: number;
  immune?: string[];
  color: string;
  tests: string;
  behavior: string;
}

export interface Preset {
  id: string;
  name: string;
  grip: string;
  shaft: string;
  cap: string;
  spine: (string | null)[];
  flanks: Record<string, string>;
}

export const FAMILIES = materialsJson.families as Record<Family, { velocity: number; tempo: number }>;
export const MATERIALS = materialsJson.materials as Material[];
export const ELEMENTS = elementsJson.elements as Record<ElementId, ElementDef>;
export const REACTIONS = elementsJson.reactions as Record<string, Reaction>;
export const SECOND_ORDER = elementsJson.secondOrder as Record<string, Reaction>;
export const CRYSTALS = crystalsJson.crystals as Crystal[];
export const QUALITIES = crystalsJson.quality as Quality[];
export const DUMMIES = dummiesJson.dummies as DummyDef[];
export const PRESETS = presetsJson.presets as Preset[];

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
const materialMap = byId(MATERIALS);
const crystalMap = byId(CRYSTALS);
const qualityMap = byId(QUALITIES);

export function material(id: string): Material {
  const m = materialMap.get(id);
  if (!m) throw new Error(`Unknown material: ${id}`);
  return m;
}

export function crystal(id: string): Crystal {
  const c = crystalMap.get(id);
  if (!c) throw new Error(`Unknown crystal: ${id}`);
  return c;
}

export function quality(id: string): Quality {
  const q = qualityMap.get(id);
  if (!q) throw new Error(`Unknown quality: ${id}`);
  return q;
}

/** Every reaction (first and second order), by id. */
export const ALL_REACTIONS: Reaction[] = [...Object.values(REACTIONS), ...Object.values(SECOND_ORDER)];
