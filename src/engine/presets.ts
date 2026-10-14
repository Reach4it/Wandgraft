import { PRESETS, Preset, Zone } from './data';
import { WandBuild, refit, wandStats, zoneRange } from './wand';

/** Lay a preset's crystals out zone by zone: hilt sockets first, then shaft, then tip. */
export function buildFromPreset(p: Preset, quality = 'clear'): WandBuild {
  const base: WandBuild = refit({ form: p.form, hilt: p.hilt, shaft: p.shaft, tip: p.tip, spine: [], flanks: {} });
  const st = wandStats(base);
  const spine: WandBuild['spine'] = Array(st.sockets).fill(null);
  for (const zone of ['hilt', 'shaft', 'tip'] as Zone[]) {
    const [start, end] = zoneRange(st, zone);
    (p.crystals[zone] ?? []).forEach((id, k) => {
      if (id && start + k < end) spine[start + k] = { id, quality };
    });
  }
  const flanks: WandBuild['flanks'] = {};
  for (const [gap, id] of Object.entries(p.flanks)) flanks[Number(gap)] = { id, quality };
  return refit({ ...base, spine, flanks });
}

export function preset(id: string): WandBuild {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return buildFromPreset(p);
}
