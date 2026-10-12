# Wandgraft

A wand-crafting action game: graft wands from grip, shaft and cap, socket crystals in an order that matters, and watch them fuse into spells. The full design lives in [docs/DESIGN.md](docs/DESIGN.md).

## What's here now: the Wand Lab

The first prototype stage. A wand bench next to a small isometric firing range with six test dummies.

- Graft any of the 34 wand materials as grip, shaft and cap.
- Socket 4 element crystals and 22 modifiers at four quality tiers, including flank sockets.
- See the full shot readout before firing, plus a step-by-step packet trace.
- Fire at the Straw Dummy, Stone Sentinel, Iron Knight, Wisp Lantern, Treant Stump and Ember Golem, with a damage log explaining every hit.
- Sandbox switches: infinite charge, overloads on or off, slow time, reset.
- Load the example builds from the design doc, or save your own (per browser).

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
| `src/data/*.json` | Game data: materials, elements and reactions, crystals, dummies, example builds. Moves to Godot unchanged. |
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
