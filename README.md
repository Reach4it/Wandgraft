# wandGraft

A wand-crafting action game: graft wands from a hilt, shaft and tip, socket crystals in an order that matters, and watch them fuse into spells. The full design lives in [docs/DESIGN.md](docs/DESIGN.md).

## What's here now: the Wand Lab

The first prototype stage. A wand bench next to a small isometric firing range with six test dummies.

- Pick a wand form: a beginner's 2-socket twig (shaft only), a 4-socket wand, a 6-socket grafted wand, an 8-socket master wand or a 10-socket archwand. There are no staves.
- Crystals sit in all three zones and flow as one chain: the hilt sets the base, the shaft shapes the flight, the tip decides exit and impact.
- Graft any of the 34 wand materials as hilt, shaft and tip. Each material does something different in each slot, and its part card shows all three roles.
- Drag and drop everything: materials onto the hilt, shaft or tip, crystals into any socket or side slot, crystals between sockets, and anything off the wand to remove it. Works with a mouse or a finger.
- Follow the 11-lesson tutorial in the side panel, from a bare twig to side slots.
- See the built wand turning in 3D, and in the wizard's hand on the range.
- Socket 4 element crystals and 22 modifiers at four quality tiers, including side slots.
- See the full shot readout before firing, plus a step-by-step packet trace.
- Switch between day and night, clear, rain and storm: hilts charge from different sources, and some tips change with the time of day.
- Fire at the Straw Dummy, Stone Sentinel, Iron Knight, Wisp Lantern, Treant Stump and Ember Golem, with a damage log explaining every hit.
- Sandbox switches: infinite charge, overloads on or off, slow time, reset.
- Load 28 sample builds, from beginner twigs to a full 10-socket archwand, or save your own (per browser).

Controls: WASD to move, hold left click to fire, B to hide the bench.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # golden-build tests for the shot rules
npm run build    # one self-contained file: dist/index.html
```

## Layout

| Path | What it is |
| --- | --- |
| `src/data/*.json` | Game data: wand forms, materials (with hilt, shaft and tip roles), elements and reactions, crystals, dummies, sample builds. Moves to Godot unchanged. |
| `src/engine/` | Shot rules as pure logic (no graphics): wand stats, the 7-step shot resolution, overloads. Ported line for line to GDScript later. |
| `tests/` | Golden builds: the doc's example builds as automated checks. The Godot port must pass the same checks. |
| `src/lab/` | The Wand Lab itself: Three.js range, bench and side panel. |
| `docs/DESIGN.md` | The design document. |

## Plan

1. Wand Lab (this)
2. Duel Lab: off-hand wards, hand swap, cross-current
3. Isometric arena with terrain reactions and draw sources
4. Class slice: Pyromancer and Tidecaller, marks, part of the radial tree, one legendary

Then move to Godot 4.7 for the full game.
