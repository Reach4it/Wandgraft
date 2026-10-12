import { PRESETS, Preset, material } from './data';
import { WandBuild } from './wand';

export function buildFromPreset(p: Preset, quality = 'clear'): WandBuild {
  const sockets = material(p.shaft).sockets;
  const spine = Array.from({ length: sockets }, (_, i) => {
    const id = p.spine[i];
    return id ? { id, quality } : null;
  });
  const flanks: WandBuild['flanks'] = {};
  for (const [gap, id] of Object.entries(p.flanks)) flanks[Number(gap)] = { id, quality };
  return { grip: p.grip, shaft: p.shaft, cap: p.cap, spine, flanks };
}

export function preset(id: string): WandBuild {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return buildFromPreset(p);
}
