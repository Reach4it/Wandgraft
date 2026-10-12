import { PRESETS, Preset } from './data';
import { WandBuild, refit } from './wand';

export function buildFromPreset(p: Preset, quality = 'clear'): WandBuild {
  const flanks: WandBuild['flanks'] = {};
  for (const [gap, id] of Object.entries(p.flanks)) flanks[Number(gap)] = { id, quality };
  const spine = p.spine.map((id) => (id ? { id, quality } : null));
  return refit({ form: p.form, grip: p.grip, shaft: p.shaft, cap: p.cap, spine, flanks });
}

export function preset(id: string): WandBuild {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return buildFromPreset(p);
}
