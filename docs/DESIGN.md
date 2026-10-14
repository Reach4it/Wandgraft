# wandGraft — Wand & Crystal System

Oct 12, 2026 · @Lord Berg

## The name: wandGraft

The working title is **wandGraft**: you don't just hold a wand, you graft crystals into it, and the wand becomes whatever you build. Web searches for "Wandgraft" turned up no game, studio or product using it.

Nearby names that are taken, so steer clear of them:

- **Wandness: WandCraft Survivor** — a 2025 Steam roguelike that also crafts wands from components and elemental gems. It is the closest competitor in concept ([Steam summary](https://gamegeeker.com/zh/games/wandness-wandcraft-survivor-2928690)).
- **Wandsmiths** — an itch.io tabletop RPG about making wands and staves ([itch.io](https://luka12-2.itch.io/wandsmith)).
- Wand Wars, Wands (card game), and the cheat-tool app "Wand" also exist.

Backup names if you want options: Shardwright, Spinecraft, Lattice & Bough. Before committing, check Steam, itch.io and a trademark search (USPTO) one more time.

## Core premise

A wand is a channel, not a gun: charge enters at the handle, travels up the shaft through every crystal in order, and leaves the tip as a shot. Every crystal reads what reaches it, changes it, and passes it on, so the same five crystals in a different order make a different spell.

Every shot is a **charge packet** that carries six values as it moves up the wand:

| Packet value | What it means |
| --- | --- |
| Power | Damage or effect strength |
| Elements | Which element tags it carries (Fire, Water, Steam…) |
| Form | Bolt, stream, shard, beam, cloud, wall, lob |
| Count | How many projectiles |
| Speed | Travel velocity |
| Heat | Strain on the wand; too much causes an overload |

The player's loop:

1. Find or craft a wand body. The material sets the base stats, socket count and personality.
2. Find crystals: four element crystals plus a large pool of modifier crystals.
3. Graft crystals into sockets. Order, adjacency and side (flank) sockets decide the output.
4. Test-fire, watch what happens, rearrange. Discovery is the fun: the game never shows a full recipe list.

The name comes from **grafting wand bodies**. A wand has three parts (hilt, shaft, tip) and any wandwright can join different materials, such as a silver tip on a yew shaft. The hilt sets the base and the draw source, the shaft shapes the flight and sets sockets and conductivity, and the tip sets the impact and what the shot bites hardest. Crystals sit in all three.

## Wand forms: hilt, shaft and tip

A wand grows with its wizard, from a 2-socket twig to a 10-socket archwand. There are no staves: every wand is held in one hand, so the other hand stays free for a ward. Crystals sit in all three zones and flow as one chain: hilt, then shaft, then tip.

| Form | Parts | Hilt sockets | Shaft sockets (max) | Tip sockets | Total | Side slots | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Twig | Shaft only | 0 | 2 | 0 | 2 | None | Where everyone starts. ×0.85 power. With no hilt, the first crystal sets the base. |
| Wand | Hilt + shaft | 1 | 3 | 0 | 4 | None | The hilt sets the base and where charge comes from. |
| Grafted wand | Hilt + shaft + tip | 1 | 4 | 1 | 6 | 1, if the shaft has room | The tip decides exit and impact. |
| Master wand | Hilt + shaft + tip | 2 | 5 | 1 | 8 | All the shaft allows | ×1.1 power. |
| Archwand | Hilt + shaft + tip | 2 | 6 | 2 | 10 | All the shaft allows | The rarest wands. ×1.2 power. |

Shaft sockets = the shaft material's natural sockets (+1 on a master wand, +2 on an archwand), capped by the form. Hilt and tip sockets come with the form once that part is fitted. Crystals are never locked in: you can move them between any sockets at any time.

### What each zone does

| Zone | Its job in the chain | Crystals that work harder here | The part's material decides |
| --- | --- | --- | --- |
| Hilt | Sets the base: an element here is the core of the spell (+20%) | Sunstone, Thriftstone, Wellspring, Siphon (×1.5) | Where charge comes from, capacity, recharge, the wielder's side |
| Shaft | Shapes the shot in flight | Twinspar, Prismite, Swiftquartz, Bloatstone, Needlepoint, Seeker's Eye, Mortar, Echo Opal (×1.25) | Shaft sockets, side slots, conductivity, stability; most material quirks |
| Tip | Decides what happens on exit and impact | Nova Pearl, Lingerite, Seedstone, Lancet, Ricochet (×1.5) | Potency, shot speed, bite (what it hits hardest) |

Each element crystal answers to the material of the zone it sits in. Fire in an Emberpine hilt is in harmony; the same Fire in a Willow shaft clashes. So the same crystal gets stronger or weaker depending on where you put it.

**Side slots.** Rare shafts have diamond side slots above the gap between two sockets. A crystal there tints the sockets on both sides at full strength, and the next socket toward the tip at half strength, so it touches 2 or 3 sockets.

**Draw sources depend on conditions.** A hilt's charge mix (for example Willow: rain and water 60%, you 30%, moonlight 10%) refills faster or slower with time of day, weather and whether you are moving. A Basalt hilt barely charges while you run; a Silver tip hits 50% harder at night. The Wand Lab has day, night, rain and storm settings to test this.

Stats blend across the parts, leaning on the part that owns them: Potency is 50% tip, Capacity and Recharge are 50% hilt, Stability and Conductivity lean on the shaft. A missing part's share falls to the shaft. Every material's three roles are in the game data (src/data/materials.json) and on its part card in the Wand Lab.

## Base wand stats

Every material has the same 14 stats in different proportions; numeric stats run 1–10. The material tables below show the five core numbers as P/C/R/S/Cn.

| Stat | Short | What it controls |
| --- | --- | --- |
| Potency | P | Raw power added to every shot |
| Capacity | C | Size of the charge reservoir (shots before empty) |
| Recharge | R | How fast the reservoir refills |
| Stability | S | Heat the wand tolerates before overloading |
| Conductivity | Cn | How much of each crystal's boost survives the trip to the tip; low conductivity punishes long chains |
| Drain | — | Charge spent per shot, before crystals add cost |
| Resonance | — | How strongly the tip echoes energy back down the shaft (feedback) |
| Velocity | — | Base projectile speed |
| Focus | — | Accuracy and spread |
| Tempo | — | Cast speed; heavy wands fire slowly |
| Draw source | — | Where recharge comes from, as a mix (see below) |
| Bite | — | What the wand damages best and worst |
| Affinity | — | Bonus or penalty per element |
| Sockets | — | Spine slots, plus the chance of flank slots |

**Draw sources.** Each material splits its recharge among these, e.g. Willow = 60% Ambient water, 30% Wielder, 10% Moon:

- **Wielder** — your stamina or health; always available, but it tires you.
- **Ambient** — the environment: sunlight, rain, open ground, wind, fire nearby, moonlight.
- **Kill** — spikes of charge when the wand finishes something.
- **Motion** — charges while you sprint, fall or ride.
- **Stillness** — charges while you stand still or crouch.
- **Damage taken** — charges when you are hurt (comeback wands).

**Bite categories.** A wand's damage is multiplied by target type: Flesh, Plant, Stone and structures, Metal and armor, Spirit and undead, Wards and other magic. A bone wand might deal ×1.5 to Spirit and ×0.6 to Stone.

## Wand materials

Each family has a personality: woods are flexible and alive, metals conduct and resist, stone is heavy and stores a lot, bone remembers what it once was, crystal amplifies crystals, and exotics break the rules. Numbers are P/C/R/S/Cn on a 1–10 scale; sockets are spine slots plus flank chance.

### Woods — balanced, alive, draw from the world

| Material | P/C/R/S/Cn | Draws from | Bites best | Sockets | Signature quirk |
| --- | --- | --- | --- | --- | --- |
| Willow | 4/5/7/6/8 | Rain and water 60%, wielder 30%, moon 10% | Plant, flesh | 4, flank 15% | Bends: shots curve slightly toward your aim drift, easy to steer |
| Ironbark Oak | 5/7/4/9/5 | Open ground 50%, wielder 50% | Stone | 4, flank 5% | Almost never overloads; slow tempo |
| Ashen Yew | 7/4/3/5/6 | Kills 70%, wielder 30% | Spirit and undead | 3, flank 10% | Graveyard wood; each kill briefly doubles recharge |
| Emberpine | 6/4/6/3/6 | Fire nearby 50%, sun 30%, wielder 20% | Plant, flesh | 3, flank 10% | Resin ignites when overheated: overloads become fire bursts instead of misfires |
| Hollowreed | 3/2/9/5/7 | Motion 60%, wind 40% | Flesh | 6, flank 25% | Many sockets, tiny reservoir; a fast, fiddly build wand |
| Knotwood | 5/5/5/4/5 | Wielder 100% | Varies | 3 + 1 knot | One random knot socket per wand that doubles its crystal's effect |

### Metals — conduct, resist magic, cut through armor

| Material | P/C/R/S/Cn | Draws from | Bites best | Sockets | Signature quirk |
| --- | --- | --- | --- | --- | --- |
| Copper | 4/3/6/4/10 | Storms and wind 50%, wielder 50% | Metal and armor | 5, flank 10% | Perfect conductor; high resonance, so feedback loops run hot |
| Cold Iron | 6/6/4/8/3 | Wielder 70%, stillness 30% | Wards, spirit | 3, flank 0% | Shots break magic shields; poor conductor, best with 1–2 crystals |
| Silver | 5/5/5/6/8 | Moonlight 60%, wielder 40% | Spirit and undead | 4, flank 15% | Twice as strong at night, half at noon |
| Gold | 4/10/2/7/7 | Sunlight 70%, stillness 30% | Wards | 4, flank 10% | Hoarder: huge reservoir, slow refill; can dump the whole tank in one shot |
| Star-iron | 8/5/5/4/6 | Night sky 80%, wielder 20% | Everything ×1.1 | 2–6 random | Meteoric; socket count is random per wand, rare flank spots common (30%) |
| Quicksilver Rod | 6/6/6/3/9 | Wielder 100% | Flesh | 5, flank 0% | Liquid metal in glass: crystals slosh, so tilting the wand while firing swaps two neighbors |

### Stone — heavy, deep reservoirs, slow

| Material | P/C/R/S/Cn | Draws from | Bites best | Sockets | Signature quirk |
| --- | --- | --- | --- | --- | --- |
| Obsidian | 9/3/5/2/6 | Fire 40%, wielder 60% | Flesh | 3, flank 5% | Glass-sharp, brutal damage, cracks easily |
| Basalt | 5/9/3/8/4 | Bare ground while still 80%, wielder 20% | Stone | 4, flank 5% | Roots you: +50% recharge standing still, nothing while moving |
| Lodestone | 5/5/5/6/5 | Ground 50%, wielder 50% | Metal and armor | 3, flank 10% | Magnetic: shots curve toward armored targets |
| Chalk | 2/4/8/2/5 | Wielder 100% | Plant | 4, flank 20% | Cheap starter; shots leave marks that later shots home in on |
| Geode | 5/6/4/6/6 | Ground 60%, wielder 40% | Stone | 3 + 1 hidden | Crack it open (permanent) to reveal a hidden inner socket that affects every crystal |

### Bone — remembers what it was

| Material | P/C/R/S/Cn | Draws from | Bites best | Sockets | Signature quirk |
| --- | --- | --- | --- | --- | --- |
| Wolf Femur | 6/4/6/5/6 | Kills 40%, nearby allies 40%, wielder 20% | Flesh | 4, flank 10% | Pack: +15% recharge per ally or companion near you |
| Bird Hollowbone | 3/3/8/4/7 | Motion 60%, wind 40% | Flying targets | 4, flank 15% | Fastest shots in the game |
| Whalebone | 5/8/5/7/7 | Water 70%, wielder 30% | Flesh | 5, flank 10% | Shots carry a deep pulse that knocks targets back |
| Antler | 5/5/6/6/6 | Season and growth 50%, wielder 50% | Plant | 3, grows to 5 | Self-repairs; grows a new socket each in-game spring |
| Dragon Rib | 9/7/4/5/7 | Fire 50%, kills 30%, wielder 20% | Everything | 5, flank 20% | Legendary; fire crystals in it count double |
| Saint's Knuckle | 4/5/6/8/6 | Wielder's calm (stillness) 100% | Spirit and undead ×2 | 2, flank 0% | Relic; cannot be used for harmful spells on the living, only on the dead and on wards |

### Crystal bodies — amplify the crystals inside them

| Material | P/C/R/S/Cn | Draws from | Bites best | Sockets | Signature quirk |
| --- | --- | --- | --- | --- | --- |
| Clear Quartz | 4/5/5/5/9 | Sunlight 50%, wielder 50% | Wards | 5, flank 20% | Every modifier crystal +20% |
| Amethyst | 4/6/5/9/7 | Wielder 100% | Spirit | 4, flank 15% | Calm stone: backlash from overloads is halved |
| Prismglass | 5/4/6/3/8 | Sunlight 80%, wielder 20% | Flesh | 4, flank 25% | Every shot also splits a weak copy off each side |
| Rime Crystal | 6/5/7/4/8 | Cold 70%, wielder 30% | Fire-type foes | 4, flank 15% | Melts in heat: loses Stability near fire, freezes Water shots into ice |
| Rock Salt | 5/4/5/5/6 | Wielder 100% | Spirit and undead ×1.5 | 3, flank 10% | Purifying; slowly dissolves if used in rain or with Water crystals |

### Exotics — rule breakers

| Material | P/C/R/S/Cn | Draws from | Bites best | Sockets | Signature quirk |
| --- | --- | --- | --- | --- | --- |
| Living Coral | 4/6/7/5/7 | Seawater 80%, wielder 20% | Flesh | 3, grows to 6 underwater | Alive: grows new sockets if kept in water; dies if left dry too long |
| Amber (with insect) | 5/5/5/6/6 | Sunlight 50%, wielder 50% | Plant | 4, flank 10% | Memory: every 5th shot replays the previous shot for free |
| Nautilus Shell | 5/5/5/4/7 | Water 50%, wielder 50% | Flesh | 4 in a spiral | Spiral spine: the last socket feeds back into the first (built-in loop) |
| Thornvine | 8/5/9/4/6 | Wielder's blood 100% | Flesh | 4, flank 15% | Huge power and recharge, paid in your health |
| Fulgurite | 7/4/8/3/9 | Storms 90%, wielder 10% | Metal | 4, flank 20% | Lightning-made glass; only fully charges during storms |
| Dreamwood | 5/5/5/5/5 | Sleep and rest 100% | Spirit | 4, flank 30% | Shows a ghost preview of the next shot's shape before you fire |

**Material + element affinity** is covered in the element section: each material harmonizes with some elements and clashes with others, and clashes are not just penalties.

## Crystal sockets

Charge always flows handle to tip, so a crystal can only change what is upstream of it, and the tip crystal has the final word. Sockets come in five kinds.

| Socket | Where | Rarity | What it does |
| --- | --- | --- | --- |
| Spine | Along the hilt, shaft and tip, numbered S1 (hilt end) to Sn (tip end) | Every wand, 2–10 | Main chain; the packet passes through each in order |
| Flank | On the side, between two spine sockets | 0–30% per gap, by material | Not in the chain; its crystal tints both neighbors, and the next socket toward the tip at half strength |
| Pommel | Butt of the handle | Uncommon | Affects only you and the reservoir: recharge source, backlash, self-buffs |
| Ring | A band around the shaft | Very rare | Touches every spine crystal at 30% strength |
| Knot / Hidden | Random spot (Knotwood, Geode) | Material-specific | Doubles its crystal's effect, or affects the whole chain |

**Socket count by wand size:** twig 2, wand 4, grafted wand 6, master wand 8, archwand 10 (see Wand forms). Sockets beyond a material's natural count can be carved, but each carved socket costs 1 Stability.

### Position roles along the spine

- **Root (S1, near the hand)** — sets the core element and feeds the wielder side. Effects here also touch you: a Fire root warms you in the cold, a Thornvine root takes blood.
- **Middle sockets** — shape and multiply. This is where most reactions and order tricks happen.
- **Tip (last socket)** — sets delivery. Whatever is in the tip decides the final form: a Beam crystal at the tip makes everything a beam.

### The order rules

1. **Forward flow.** Each crystal sees only what is upstream. Fire in S1 then Prism in S2 = three fire bolts. Prism in S1 then Fire in S2 = three neutral bolts, each coated in fire.
2. **Before vs after a multiplier.** A crystal placed before a multiplier is copied onto every projectile at full strength, and full cost. Placed after, it is shared, so each copy is weaker but cheaper. The player is always trading power against drain.
3. **Core and coat.** When two element crystals touch, the upstream one is the core and the downstream one is the coat. Fire then Water = a fire core in a water shell that bursts into steam on impact. Water then Fire = a boiling water stream.
4. **Conductivity fade.** Each step, boosts lose (10 − Cn) × 5% of their value. A Copper wand (Cn 10) loses nothing; Cold Iron (Cn 3) loses 35% per step, so long chains on iron are a waste.
5. **Tip authority.** If two crystals both set Form, the one closest to the tip wins; the other's effect becomes a bonus (e.g. a Lob before a Beam gives the beam a downward arc).

### Flank sockets

A flank crystal never fires on its own. It sits between two spine sockets and changes both neighbors:

- **Element in a flank** — tints both neighbors: a Water flank between two Fire crystals turns both into steam bursts.
- **Modifier in a flank** — applies to both neighbors at 60%: a Swift flank speeds both.
- **Catalyst or Resonator in a flank** — the strongest use: it makes the two neighbors react with each other even if they are not elements.

Because flanks are rare, a wand with a good flank in the right gap is a treasure, which drives exploration and trading.

## The four element crystals

Earth, Wind, Fire and Water give a shot its nature: what it does on hit, how it travels, and what it destroys. An element crystal also has a mood toward the wand body: harmony, neutral, or clash.

| Element | Shot behavior | Strong vs | Weak vs | Bonus recharge from |
| --- | --- | --- | --- | --- |
| Fire | Fast bolt, burns over time, ignites ground and plants | Plant, flesh, ice, webs | Stone, water creatures | Sun, open flame |
| Water | Heavy stream, knockback, puts out fire, soaks targets | Fire, earth constructs (erosion) | Plants (it feeds them) | Rain, rivers, sea |
| Earth | Slow heavy shards, breaks armor, can raise cover | Structures, armor, shields | Flyers | Standing on bare ground |
| Wind | Fastest, pierces, pushes, curves and ricochets | Flyers, gas, spirits, swarms | Heavy armor, stone | Moving, heights, storms |

**Soaked** targets matter later: soaked enemies take double from lightning and freeze under cold.

### Element vs wand material

| Element | Harmonizes with | Clashes with | What a clash produces |
| --- | --- | --- | --- |
| Fire | Emberpine, Dragon Rib, Obsidian, Gold | Willow, Whalebone, Rime Crystal, Living Coral | Steam: weaker fire, but shots leave a blinding mist |
| Water | Willow, Whalebone, Coral, Silver | Emberpine, Rock Salt, Chalk | Erosion: the wand slowly wears, but shots dissolve armor |
| Earth | Basalt, Ironbark, Geode, Lodestone | Hollowreed, Bird Hollowbone, Fulgurite | Dust: slower shots that blind on impact |
| Wind | Hollowreed, Bird Hollowbone, Copper, Nautilus | Basalt, Gold, Cold Iron | Howl: wild spread, but a fear effect on enemies |

- **Harmony:** +25% to that element, and the material's quirk gets stronger.
- **Neutral:** no change.
- **Clash:** −20% to that element, +1 Heat per shot, but the clash byproduct above is added free. Clashes are a choice, not a mistake.

### Element pair reactions

When two element crystals sit next to each other on the spine, they fuse. Rows are the upstream crystal (core), columns the downstream one (coat).

| Core ↓ / Coat → | Fire | Water | Earth | Wind |
| --- | --- | --- | --- | --- |
| **Fire** | White Flame: pure heat, ignores fire resistance | Steam Bomb: bursts into scalding blinding cloud | Magma Shard: lands and pools as lava | Wildfire: flames that leap target to target |
| **Water** | Boiling Jet: scalding stream, strips buffs | Tidal Wave: wide, sweeping knockback | Mire: mud pool that roots enemies | Storm Bolt: lightning that chains between soaked foes |
| **Earth** | Volcanic Lob: arcing rock that erupts | Quicksand: sinks and holds a target | Tremor: ground shockwave in a line | Sandblast: cone that strips armor and blinds |
| **Wind** | Firestorm: spinning column of flame | Hail: freezing shards in a spread | Dust Devil: moving vortex that pulls in debris | Cyclone: tornado that lifts small enemies |

**Fused elements keep reacting.** A fusion becomes a new element tag (Steam, Magma, Storm…) that can react with the next crystal down the chain. Three examples:

- Steam + Earth → **Geyser**: eruptions from the ground at the impact point.
- Magma + Water → **Obsidian Spikes**: cooling lava hardens into a wall of spikes.
- Storm + Fire → **Plasma**: a short-range lance that melts metal armor.

All four elements in one wand (any order) unlock a hidden fifth element, **Aether**, described in the synergy section.

## Modifier crystals

Modifiers have no element of their own; they bend whatever packet reaches them. Each has a different payoff upstream (early in the chain) versus downstream (near the tip), which is what makes order a puzzle.

### Power

| Crystal | Effect | Upstream vs downstream |
| --- | --- | --- |
| Sunstone | +40% power | Upstream: boost is multiplied by later multipliers. Downstream: boost is safe from conductivity fade |
| Bloodgarnet | +100% power, costs your health per shot | In the pommel it costs half; at the tip it also makes shots drain life |
| Heartstone | Power scales with your current health | Root: also heals you slightly on kills |
| Grudgestone | Power grows each time you are hit, resets on firing | Best at the tip for a single revenge shot |

### Count and spread

| Crystal | Effect | Upstream vs downstream |
| --- | --- | --- |
| Twinspar | Fires 2 projectiles | Upstream: each copy gets every later crystal at full cost. Downstream: splits the finished shot in half |
| Prismite | Fan of 3 (5 when flawless) | Same as Twinspar; next to Wind it widens to a 120° cone |
| Echo Opal | Repeats the shot 0.5 s later at 60% | Downstream of a Resonator, echoes can echo |
| Seedstone | On impact, bursts into 4 seedlings | Elements upstream of it are carried into the seedlings |

### Form and flight

| Crystal | Effect | Upstream vs downstream |
| --- | --- | --- |
| Swiftquartz | +60% speed | Downstream also adds pierce at high speed |
| Lancet Spinel | Pierces through targets | Each pierce downstream of Fire spreads the burn |
| Ricochet Beryl | Bounces off walls 3 times | Gains power per bounce when downstream of Earth |
| Seeker's Eye Agate | Homes on targets | Upstream of a multiplier: copies pick different targets |
| Beam Topaz | Becomes a continuous beam, drains per second | Sets form if closest to the tip |
| Mortar Jade | Arcing lob over cover | Sets form; lobbed elements land as zones |
| Wallglass | Shot becomes a barrier where it lands | Elements make elemental walls (fire wall, ice wall) |
| Orbit Moonstone | Shots circle you as a shield before launching | Upstream of Twinspar: two orbiting guardians |

### Size, area and time

| Crystal | Effect | Upstream vs downstream |
| --- | --- | --- |
| Bloatstone | Bigger and slower, more power | Paired with Swiftquartz, the two cancel and leave only power |
| Needlepoint | Smaller, faster, critical hits | Pairs well with Lancet |
| Nova Pearl | Explodes on impact (area) | Elements upstream decide the blast type |
| Lingerite | Leaves a lasting zone | Fire zone burns, Water zone slows, Wind zone pushes |
| Fuse Garnet | Delayed blast; fire again to detonate early | Lets you plant traps |

### Economy and charge

| Crystal | Effect | Upstream vs downstream |
| --- | --- | --- |
| Thriftstone | −30% drain | Root position: also slows Heat |
| Wellspring Aquamarine | +50% recharge | Pommel: doubles; adds Water as a draw source |
| Capacitor Tourmaline | Hold to charge; stores overflow for a big release | Downstream: the release inherits every crystal |
| Siphon Jet | Damage dealt refills the wand | Pairs with Ashen Yew for near-endless fire |
| Ember Coal | Turns Heat into power instead of risk | Risky: removes the overload warning |

### Control and utility

| Crystal | Effect | Upstream vs downstream |
| --- | --- | --- |
| Tetherstone | Pulls target toward you | With Earth: pulls the ground up as a ramp |
| Bindstone | Roots targets in place | With Water it freezes them; with Wind it suspends them |
| Fearglass | Enemies flee briefly | With Fire: panic spreads to nearby enemies |
| Lantern Opal | Shots light the area | With Wind: light drifts and scouts ahead |
| Mender's Jade | Shots heal allies instead of harming | Water + Mender = healing rain |
| Verdant Stone | Grows plants where shots land | Earth + Verdant = vine bridges |

### Meta crystals (change the system itself)

| Crystal | Effect |
| --- | --- |
| Resonator | Sends 40% of everything downstream back to the root, making upstream crystals fire again. Creates feedback loops; each loop adds 1 Heat |
| Catalyst | Adjacent element reactions are twice as strong, and non-adjacent elements within 2 sockets also react |
| Inverter | Reverses the order of every crystal downstream of it. A one-crystal way to flip core and coat |
| Mimic | Copies the crystal directly upstream |
| Null Stone | Blank spacer: passes the packet through and stops two crystals from reacting |
| Dampener | Blocks feedback and Heat from passing upstream; a safety valve |
| Chaos Opal | A random modifier every shot |
| Keystone | Does nothing unless every other crystal shares one element; then +100% and a unique signature spell |

## Synergy engine

Every shot resolves in the same seven steps, which is what makes a huge number of combinations predictable enough to learn but deep enough to keep surprising.

1. **Draw.** The wand pulls charge from its draw-source mix; the pommel crystal adjusts this.
2. **Seed.** The packet starts with the material's Potency, Velocity and Bite, with Heat 0.
3. **Halo pass.** Flank and ring crystals tint the spine crystals they touch before anything fires.
4. **Forward pass.** S1 to the tip, one socket at a time: apply the crystal, apply conductivity fade, check for reactions with the previous element.
5. **Feedback pass.** If a Resonator, Nautilus spiral or high-Resonance material is present, a share of the finished packet flows back to the root and runs forward again. Each loop is weaker (40%, then 16%…) and adds Heat.
6. **Heat check.** If Heat exceeds Stability, roll on the overload table.
7. **Release.** The tip sets the form; the shot fires.

### Heat and overload

Every crystal adds 1 Heat; clashes, feedback loops and Bloodgarnet add more. Over the Stability limit, the wand overloads:

| Roll | Overload result |
| --- | --- |
| Mild | Fizzle: shot fails, charge lost |
| Moderate | Backlash: the shot's element hits you at 25% |
| Severe | Crack: wand loses 1 Stability permanently until repaired |
| Wild | Surge: the shot fires at triple power with a random extra element |

The Wild surge makes pushing past the limit tempting, which is the point. Emberpine turns every overload into a fire burst; Amethyst halves backlash.

### Set bonuses (chords)

- **Pure chord** — three or more of the same element: that element's fused form is upgraded (White Flame, Cyclone…).
- **Opposed pair** — Fire and Water, or Earth and Wind, in the same wand but not adjacent: +1 Stability (they balance each other).
- **Full circle** — all four elements present: unlocks **Aether**, a fifth element that bites wards and spirits and ignores resistances. Aether is unstable: +3 Heat.
- **Material echo** — a crystal sourced from the same place as the wand (a Water crystal from the same lake as the Willow) gets +15%.

### Attunement

A wand slowly learns its current chain. After about 200 shots with the same layout it gains +10% power and −1 Heat, up to 3 levels. Swapping one crystal keeps half the attunement; rebuilding the whole wand resets it. This rewards committing to a build without locking anyone in.

### Why the combinations explode

With 4 elements, about 40 modifiers, 3–7 spine sockets, flanks and order all mattering, a single 5-socket wand has millions of possible layouts. The rules above keep them readable: forward flow, core and coat, before and after multipliers, and Heat as the cost of greed.

## Worked example builds

The same crystals in a different order make a different spell; these builds show the rules in action. Chains read handle → tip.

### Same crystals, two orders (Basalt wand)

- **Earth → Twinspar → Fire:** two earth shards, then Fire coats each one at full strength. Twinspar sits between the two elements, so they never fuse: each copy carries Earth and Fire side by side. Costly: Fire's drain is paid twice.
- **Earth → Fire → Twinspar:** one Volcanic Lob is built, then split. Result: two weaker Volcanic Lobs, much cheaper. Better for sustained fire; worse for burst.

### Scalding Lance (Willow, 4 sockets)

Water → Fire → Lancet Spinel → Swiftquartz. Water core with a fire coat makes a Boiling Jet. Fire clashes with Willow, so the shot is a bit weaker but leaves blinding steam for free. Lancet then pierces, and Swiftquartz at the tip adds speed plus extra pierce. Output: a fast, scalding needle that punches through a line of enemies and leaves mist behind.

### Storm Shepherd (Copper, 5 sockets + 1 flank)

Water → Wind → \[flank: Catalyst\] → Prismite → Seeker's Eye → Echo Opal. Water core with Wind coat = Storm Bolt. The Catalyst flank doubles the reaction. Prismite fans it into three, Seeker's Eye sends each copy to a different target, and Echo Opal repeats the volley. Copper's perfect conductivity means nothing fades. Output: three homing lightning bolts that chain between soaked enemies, then fire again half a second later.

### Wildfire Reaper (Ashen Yew, 3 sockets + flank)

Fire → \[flank: Catalyst\] → Wind → Siphon Jet. Fire core with Wind coat = Wildfire, made stronger by the Catalyst. Each kill doubles recharge (Yew) and Siphon refills the wand from damage. Output: a fire that hops through a crowd and almost never runs dry, at the risk of setting the forest alight.

### Greed Loop (Nautilus, 4-socket spiral)

Sunstone → Fire → Resonator → Nova Pearl. The Nautilus spiral feeds the tip back to the root, and the Resonator adds a second feedback path. Every loop re-runs Sunstone and Fire, so the explosion grows, but Heat climbs fast. Fired once, it is a huge blast. Fired twice in a row, it probably overloads, and the player gambles on a Wild surge.

### Keystone Tide (Whalebone, 5 sockets)

First try: Water → Water → Keystone → Water → Lingerite. Nothing special happens, because Lingerite has no element, so not every other crystal is Water. Swap Lingerite for a fourth Water and the Keystone wakes up: +100% power and a signature spell, a rolling tidal wave that carries enemies away. This kind of discovery is what the game should reward.

## Design decisions

| Question | Decision |
| --- | --- |
| Crystal quality tiers | Yes: five tiers, see below |
| Socket shapes | No: any crystal fits any socket |
| Where parts come from | Everything is found in the world: crystals, hilts, shafts, tips |
| Where wands are crafted | Anywhere, from the inventory screen; no workbench needed |
| Information shown | Full stats, and a live preview of the shot before you fire |
| Progression | Wands both level up and attune |
| Grafting | Available from the start: every wand is hilt + shaft + tip |

### Crystal quality tiers

| Tier | Strength | Drops |
| --- | --- | --- |
| Chipped | 60% | Common, early zones |
| Clear | 100% (the values in this doc) | Common |
| Bright | 130%, +1 minor bonus | Uncommon |
| Flawless | 160%, +1 extra effect (e.g. Prismite fires 5) | Rare |
| Legendary | Unique; see the next section | Very rare, named |

Three crystals of one tier and type fuse into one of the next tier, so no find is wasted.

## Wand levels and attunement

Levels belong to the wand's parts and are permanent; attunement belongs to the crystal layout and rewards sticking with it. The two never overlap, so swapping crystals never costs you levels.

|  | Wand level | Attunement |
| --- | --- | --- |
| Belongs to | Each part (hilt, shaft, tip) separately | The current crystal layout |
| Earned by | Damage dealt and kills with that wand | Shots fired with the same layout |
| Range | Levels 1–30 per part | 3 levels (about 200, 600, 1,500 shots) |
| Rewards | Part points to spend on that part's traits | +10% power and −1 Heat per level |
| Lost when | Never | Partly when you swap crystals (one swap keeps half) |

**Part points.** Each level gives one point to spend on that part's own small trait tree:

- **Hilt** — draw source mix (shift 10% toward a source you choose), reservoir size, backlash reduction.
- **Shaft** — Conductivity, Stability, and at levels 10, 20 and 30 a new carved socket with no Stability cost.
- **Tip** — Velocity, Focus, Bite multipliers, and at level 15 a chance to open a flank socket.

Because parts level separately, grafting is never a loss: a level-22 Silver tip moved onto a fresh Yew shaft keeps its 22 levels, and the wand's level shown in the UI is the average of its three parts.

## Legendary components

Legendaries are named, one-of-a-kind crystals and wand parts that break a rule of the system. Their main effect is fully shown, but each also hides 1–3 **resonances**: secret synergies that only appear the first time the right combination fires.

**How unknown synergy works with full information:**

- A legendary's tooltip shows its stats, its known effect, and one line per hidden resonance as `??? — reacts with something Fire-born`, a vague hint.
- The first time a resonance triggers, the shot flashes gold, the effect is named, and it is written into the **Wandwright's Codex**. From then on it is shown in full on every wand.
- Two legendaries in the same wand can also form a **legendary pair**: a unique named spell nobody can make any other way.
- Limit: one legendary crystal per wand, plus any legendary hilt, shaft or tip. A full-legendary wand is possible but extremely rare.

### Legendary crystals

| Name | Known effect | Hidden resonance (spoiler) |
| --- | --- | --- |
| Ember of the First Fire | Fire effects never fade from conductivity and cannot be put out | In a Rime Crystal body, creates **Frostfire**: burns and freezes at once |
| Heart of the Drowned King | Each soaked enemy hit stores a charge; at 10, the next shot is a tidal surge | During rain, Storm Bolts have no chain limit |
| Eye of the Tempest | Wind shots stop midair and spin as 3-second turrets | With Orbit Moonstone, becomes a wind dome that reflects arrows |
| Ouroboros Opal | The last socket feeds into the first: any wand becomes a spiral | In a Nautilus, the loop runs backward and removes Heat instead of adding it |
| Paradox Shard | Sits in one socket but counts as being in two places at once (before and after a multiplier) | With an Inverter, the wand fires its chain in both orders at the same time |
| Seed of the World Tree | Earth shots plant saplings that grow into cover during the fight | Trees count as a Plant draw source; Verdant Stone makes them fight for you |
| Gravewish Pearl | Kills leave a ghost that repeats the enemy's last attack for you | With Ashen Yew, ghosts last until dawn and follow you |

### Legendary hilts, shafts and tips

| Name | Part | Known effect | Hidden resonance (spoiler) |
| --- | --- | --- | --- |
| Hand of the Hollow Saint | Hilt | Recharges from enemies' fear: each fleeing enemy refills charge | With Fearglass, fear spreads in waves and the hilt overflows into a shield |
| Wyrmhide Hilt | Hilt | Every overload is a Wild surge, but backlash is doubled | With Dragon Rib shaft, backlash heals you instead |
| Spine of Aldrath | Shaft | 7 spine sockets, with a flank between every pair | With all four elements, the flanks become Aether sockets |
| Moonwell Rod | Shaft | Crystals rotate one socket each in-game night: the same wand plays differently each day | Under a full moon it stops rotating and locks in +50% |
| Weeping Mournwood | Shaft | Each crystal's element slowly seeps into its neighbor over time | Left alone for 7 days, it grows a new legendary crystal |
| Crown of Three Suns | Tip | Each shot fires three versions: the chain as built, reversed, and element-only | With Prismglass body, the three versions merge into one white beam |
| Bell of the Deep | Tip | Hits "tune" enemies; tuned enemies take a share of every nearby hit | Tuned enemies hit by Water ring like bells and stun the area |
| Mirrorcap of Vael | Tip | Shots that meet enemy projectiles reflect them | With Wallglass, walls become mirrors that return spells |

### Legendary pairs (examples)

- **Ouroboros Opal + Paradox Shard → Infinite Regress:** the shot fires forever at decreasing size until it fills the screen with tiny echoes. Huge Heat.
- **Ember of the First Fire + Heart of the Drowned King → Sea of Embers:** a burning tide that boils everything it touches.
- **Seed of the World Tree + Gravewish Pearl → The Barrow Grove:** fallen enemies become twisted trees that fight for you.

Legendaries drop from named bosses, hidden shrines, and rare world events, and each exists only once per world, so every save has its own story.

## Dual wands

The player carries two wands: the main hand attacks, the off hand defends, and both use the exact same parts and crystals. Any wand can go in either hand; the hand decides how its crystals are read.

- **Main hand (attack)** — fires the chain as described in this doc.
- **Off hand (ward)** — the same chain builds a defense instead of a shot: a shield, barrier, dash, or counter.
- **Swap hands** — one key swaps them mid-fight. Your fire attack wand becomes a fire ward and the other way round, so a well-built pair gives four tools.

### How the off hand reads crystals

| Crystal | In the main hand | In the off hand |
| --- | --- | --- |
| Fire | Burning bolt | Ember shield: melee attackers catch fire |
| Water | Heavy stream | Flowing ward: deflects projectiles and slowly heals you |
| Earth | Stone shard | Stone wall raised where you aim; blocks everything, breakable |
| Wind | Fast piercing shot | Gust dash: a short dodge that knocks enemies aside |
| Prismite | Fan of 3 shots | Three small floating wards around you |
| Swiftquartz | Faster shots | Ward raises instantly (parry window) |
| Nova Pearl | Explodes on impact | Shield explodes outward when it breaks |
| Beam Topaz | Continuous beam | Sustained barrier you hold up, drains per second |
| Siphon Jet | Damage refills the wand | Blocked damage refills the main-hand wand |
| Mender's Jade | Heals allies | Heals you while the ward is up |

### How the two wands talk to each other

- **Cross-current.** A main-hand shot fired through your own ward picks up the ward's element. A fire bolt through a water ward becomes a Steam Bomb. Positioning becomes a combo tool.
- **Absorption feed.** Damage your ward blocks becomes charge for the main hand (25% base).
- **Twin bond.** Both wands share a material: +1 Stability on each. Opposed elements in each hand (Fire attack, Water ward): +10% to both.
- **Shared Heat.** Overloading one hand adds half its Heat to the other, so you cannot spam both without care.

## Classes

Eight classes sit around the skill-tree circle, ordered so neighbors share a theme: Fire, Wind, Water, Nature, Earth, Death, Undead, Celestial, and back to Fire. A class never locks you out of any wand part; it changes how the wand system behaves for you.

Each class brings a **mark**: a status it puts on enemies that the four elements react with, adding a third layer on top of element-vs-element and element-vs-material reactions.

| Class | Theme | Mark | Starting wands (main / off) | How it bends the wand system |
| --- | --- | --- | --- | --- |
| Pyromancer | Fire, heat, risk | Kindled | Emberpine: Fire + Sunstone / Chalk: Fire | Heat becomes a resource: skills spend Heat, and overload limit +3 |
| Stormcaller | Wind, lightning, speed | Charged | Hollowreed: Wind + Swiftquartz / Hollowreed: Wind | Moving builds charge; Storm reactions unlocked from level 1 |
| Tidecaller | Water, flow, healing | Soaked (stronger) | Willow: Water + Lingerite / Willow: Water + Mender's Jade | Off-hand specialist: wards are 50% stronger, and Water reactions chain |
| Verdant | Nature, growth, beasts | Overgrown | Antler: Earth + Verdant Stone / Antler: Water | Shots plant growth; living plants and beast companions count as a draw source |
| Geomancer | Earth, stone, metal | Shattered (armor broken) | Basalt: Earth + Bloatstone / Ironbark: Earth | Standing still powers everything; walls from the off hand last twice as long |
| Gravewarden | Death, decay, endings | Rot | Ashen Yew: Earth + Siphon Jet / Ashen Yew: Wind | Kill draw source doubled; Rot spreads on death; executes low-health foes |
| Necromancer | Undead, minions | Raised | Wolf Femur: Earth + Seedstone / Wolf Femur: Fire | Fallen enemies rise as thralls that relay your shots like extra sockets |
| Starseer | Sun, moon, stars | Illuminated | Silver: Fire + Prismite / Gold: Wind | Power shifts with time of day; light shots bite undead and wards |

### Marks react with elements

| Mark | + Fire | + Water | + Earth | + Wind |
| --- | --- | --- | --- | --- |
| Kindled | Detonates for burst damage | Steam cloud on the target | Melted armor | Fire spreads to neighbors |
| Charged | Plasma burn | Lightning arcs to soaked foes nearby | Grounded: charge drained, stun | Thunderclap knockback |
| Soaked | Scald | Drowning slow | Mud root | Freezing chill |
| Overgrown | Burning brambles | Sudden bloom: vines root target | Thorn spikes from the ground | Pollen cloud, enemies confused |
| Shattered | Molten cracks, extra burn | Erosion, armor gone longer | Rubble burst hits nearby foes | Shrapnel cone |
| Rot | Pyre: burns corpses, area damage | Plague mist spreads Rot | Grave grip roots target | Rot spores carried far |
| Raised (on your thralls) | Thrall becomes a walking bomb | Thrall heals you when it dies | Thrall turns to a stone guardian | Thrall turns to a fast wraith |
| Illuminated | Sunflare blind | Rainbow: allies healed | Crystal growth encases target | Starlight shards ricochet |

### The Necromancer's thrall relay

The Necromancer's twist uses the wand system directly: each thrall can hold one crystal from your inventory. A shot fired through a thrall picks up its crystal as an extra socket at the end of the chain. Three thralls holding Prismite, Fire and Nova Pearl turn one plain bolt into a three-way burning explosion, so positioning your undead becomes wand building on the battlefield.

## The radial skill tree

&#91;embedded content: radial skill tree: 8 class sectors, 3 rings, bridge nodes on every border\]

You start in the center, step into one class's sector, and once you reach the second ring you can walk around the circle into the classes beside yours. Neighbors are cheap to reach; the class on the far side of the circle takes most of your points.

### Structure

| Ring | Nodes per class | What's there | Movement |
| --- | --- | --- | --- |
| Center | 1 | Pick a class; gain its mark and starting wands | Into your sector only |
| Core (ring 1) | \~12 | Class basics: mark strength, class actives, attribute boosts | Outward only |
| Specialization (ring 2) | \~20, in 2 branches | The class's two directions, plus bridge nodes on both borders | Outward, and sideways into neighbor sectors |
| Mastery (ring 3) | \~15 + 1 capstone | Keystones that change rules; the class capstone at the edge | Sideways along the ring |

**Points:** one per character level (cap 60) plus about 10 from quests, so roughly 70 points against about 400 nodes. Nobody gets everything; every character is a choice. Respec is allowed at shrines for a cost that grows each time.

**Node types:**

- **Minor** — small stat boosts (+5 Focus, +3% Fire power).
- **Notable** — named effects ("Kindling Feeds the Wand: Heat above 50% adds +1 Potency per point").
- **Wand nodes** — change the wand system: +10% flank chance on found wands, +1 crystal tier when fusing, Conductivity fade halved.
- **Active skills** — class abilities that go on the hotbar (see below).
- **Keystones** — rule breakers with a cost, e.g. *Glass Heart*: every crystal adds 0 Heat, but your wands' Stability is set to 1.
- **Bridges** — the diamonds on each border; you must own nodes on both sides to take one.

### Bridge nodes between neighbors

| Border | Bridge | Effect |
| --- | --- | --- |
| Pyromancer · Stormcaller | Wildfire Herald | Wildfire reactions jump twice as far |
| Stormcaller · Tidecaller | Eye of the Storm | Storm Bolts leave a rain cloud that soaks the area |
| Tidecaller · Verdant | Rainmother | Water shots make plants grow; growth heals allies |
| Verdant · Geomancer | Rootwarden | Earth walls sprout thorns and count as plants |
| Geomancer · Gravewarden | Barrowkeeper | Shattered enemies that die leave stone tombs as cover |
| Gravewarden · Necromancer | The Long Night | Rot on a corpse lets it rise as a stronger thrall |
| Necromancer · Starseer | Eclipse Walker | At dusk and dawn, both marks apply at once |
| Starseer · Pyromancer | Solar Herald | Fire shots under the sun become Illuminated sunflares |

### Active skills act on the wands

Spells are the wands; class actives are the hands. Each class has 5–6 actives, and the hotbar holds 4. They never fire on their own; they change what your wands do for a moment.

| Class | Example active | Effect |
| --- | --- | --- |
| Pyromancer | Overdrive | Next 3 shots ignore Stability; all Heat lands afterward at once |
| Stormcaller | Slipstream | Dash; every crystal's Speed effect doubles for 4 seconds |
| Tidecaller | Undertow | Pulls all soaked enemies to your ward |
| Verdant | Graft in the Field | Swap any two crystals mid-fight without losing attunement |
| Geomancer | Bedrock | Root in place: +100% power, off-hand walls are instant |
| Gravewarden | Last Rites | Execute an enemy under 20% health; its charge fills both wands |
| Necromancer | Raise | Raise a thrall from a corpse and hand it a crystal |
| Starseer | Shift the Sky | Swap your time-of-day bonus from sun to moon or back |

## Starting attributes

Six attributes, each wired straight into the wand system, so raising one always changes how your wands behave, not just a number on a sheet. Everyone starts at 10 in each; the class adds 6 more, and you place 5 free points at creation. Each character level adds 2 points.

| Attribute | Character effect | Wand effect |
| --- | --- | --- |
| Will (WIL) | Personal charge pool | +Stability on both wands; less backlash; stronger Wielder draw source |
| Focus (FOC) | Aim steadiness | +Modifier crystal strength; −Conductivity fade |
| Vigor (VIG) | Health, carry weight | Pays health costs (Bloodgarnet, Thornvine) more cheaply; heavier staves without slowdown |
| Affinity (AFF) | Mark strength | +Element power; harmony bonus raised, clash penalty reduced |
| Reflex (REF) | Move speed, dodge | +Tempo (cast speed); wider parry window on off-hand wards |
| Lore (LOR) | Reading, lore, hints | +Crystal Load; clearer hints for hidden legendary resonances |

**Crystal Load** is the main gate on gear. Every crystal has a load: Chipped 1, Clear 2, Bright 3, Flawless 5, Legendary 8. The total across both wands cannot pass your Load (10 + 2 × Lore, so 30 at Lore 10). A new player can fill sockets with Clear crystals but cannot run a wand full of Flawless ones until Lore rises.

### Class starting spreads

| Class | WIL | FOC | VIG | AFF | REF | LOR |
| --- | --- | --- | --- | --- | --- | --- |
| Pyromancer | 12 | 10 | 11 | 13 | 10 | 10 |
| Stormcaller | 10 | 11 | 10 | 11 | 14 | 10 |
| Tidecaller | 12 | 11 | 11 | 12 | 10 | 10 |
| Verdant | 10 | 10 | 13 | 12 | 10 | 11 |
| Geomancer | 13 | 10 | 13 | 10 | 10 | 10 |
| Gravewarden | 13 | 12 | 10 | 10 | 11 | 10 |
| Necromancer | 11 | 10 | 10 | 11 | 10 | 14 |
| Starseer | 10 | 13 | 10 | 11 | 10 | 12 |

**Derived stats** shown on the character sheet: Health (VIG), Charge pool (WIL), Crystal Load (LOR), Move speed and Tempo (REF), mark strength (AFF), and Focus spread.

## Gear slots

The character has 13 slots; the two wands are the heart, and every other slot feeds back into the wand system rather than just adding armor.

| Slot | Count | What goes there | How it ties to wands |
| --- | --- | --- | --- |
| Main-hand wand | 1 | Hilt + shaft + tip, with crystals | Your attack |
| Off-hand wand | 1 | Same parts, read as wards | Your defense |
| Head (hood, circlet, crown) | 1 | Headgear | +Focus, sight radius; some add a pommel effect to both wands |
| Body (robe, coat, bark-armor) | 1 | Armor | Health and resistances; heavy armor −Tempo, light armor +Reflex |
| Hands (gloves, gauntlets) | 1 | Gloves | Grip feel: Tempo, overload backlash, parry window |
| Feet (boots) | 1 | Boots | Move speed; some feed the Motion or Stillness draw source |
| Belt | 1 | Belt with 3 crystal pouches | Hot-swap crystals: swap a pouch crystal into a socket in combat |
| Amulet | 1 | Charm | Adds one ring socket effect to both wands |
| Rings | 2 | Rings | Element affinity, mark strength, legendary resonance boosts |
| Cloak | 1 | Cloak | Element resistance; the cloak's element tints your off-hand ward |
| Satchel | 1 | Reagent satchel | Holds spare hilts, shafts, tips for crafting anywhere; size = how many |
| Familiar | 1 | Companion creature | Carries one crystal and fires it as a tiny third wand |

### Starting kit (every class)

- Two class wands (see the class table).
- Cloth hood, robe, gloves, boots and belt with 1 open pouch.
- A small satchel with one spare hilt, shaft and tip of the class's material.
- Four Chipped crystals of random elements and a Wandwright's Codex (empty).

Rings, amulet, cloak and familiar start empty and are earned in the first hours, so the first loot always feels like it opens a new part of the system.

## Isometric play and how it all ties together

The camera looks down at a 3D world from a three-quarter angle, which shows exactly what the wand system needs: where shots travel, what they bounce off, what burns, floods and grows. The ground itself is a source of power and a target.

### Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Aim; a ground line previews the next shot's path, bounces and blast area |
| Left click | Fire main-hand wand |
| Right click | Hold: raise the off-hand ward. Tap: ward's quick effect (dash, wall, burst) |
| Q | Swap hands |
| 1–4 | Class actives |
| Belt keys (Z, X, C) | Swap a pouch crystal into a socket mid-fight |
| Tab | Wand bench: full craft screen anywhere; pauses out of combat, slows time to 25% in combat |
| Mouse wheel / middle drag | Zoom / rotate camera in 45° steps |

### The world as part of the wand

- **Draw sources are visible.** Sun patches glow gold, water shimmers, graves give off mist, storms crackle. Standing in them visibly fills your wand's reservoir.
- **Terrain reacts to elements.** Fire burns grass and trees, Water fills low ground and soaks whoever stands in it, Earth raises walls and ramps, Wind clears gas and scatters leaves to reveal hidden things.
- **Height matters.** High ground adds range and Wind power; Mortar lobs and Volcanic Lobs arc over cover; Water pours downhill.
- **Walls and pillars** set up Ricochet Beryl bounces and Mirrorcap reflections.
- **Day, night and weather** shift Silver, Gold, Starseer, Fulgurite and the Heart of the Drowned King.

### How the systems connect

| System | Feeds into | Fed by |
| --- | --- | --- |
| Exploration | Parts, crystals, legendaries, shrines | Skill tree (bridge and wand nodes find better parts) |
| Wand building | Every attack and defense | Parts, crystals, Crystal Load (Lore), class |
| Wand levels and attunement | Stronger parts, new sockets | Fighting with the same wand and layout |
| Classes and marks | A third reaction layer on every element | Skill tree choices |
| Skill tree | Actives, wand-rule keystones, bridges | Character levels |
| Attributes | Stability, Load, Tempo, element power | Character levels |
| Dual wands | Cross-current combos, absorption charge | Two builds, hand swaps |
| Environment | Draw sources, terrain reactions | Elements you fire |

### The core loop

1. Explore an area and read its terrain and draw sources.
2. Fight, using terrain, marks and both hands; wand parts level and the layout attunes.
3. Loot parts and crystals; fuse duplicates up a tier.
4. Open the wand bench anywhere, graft and rearrange, and watch the full preview change.
5. Level up: attribute points and a skill node, sometimes a bridge that unlocks a neighbor's tricks.
6. Chase a legendary, discover a hidden resonance, record it in the Codex, and rebuild around it.

The next design step would be enemies and biomes built to test specific builds, such as fire-immune golems that force a second element, or warded casters that reward Cold Iron tips.

## Tutorial and practice grounds

Crafting is taught in the **Wandwright's Hollow**, a training grove that is the game's opening area and stays open forever through a portal on the wand bench. It teaches one rule per lesson, from a bare stick to legendary resonances, then becomes a free sandbox where you can test any idea without spending real materials.

### Lessons, basic to advanced

Each lesson teaches one rule, ends with a short dummy challenge, and pays a real reward. An optional mastery goal pays a little more for players who want to show off.

| # | Lesson | Rule it teaches | Challenge | Reward |
| --- | --- | --- | --- | --- |
| 1 | A Stick and a Spark | Hilt + shaft + tip make a wand; read the stat sheet | Socket a Fire crystal in a bare Chalk twig and hit the Straw Dummy | Your class wands |
| 2 | The First Crystal | Element crystals and Bite | Break the Stone Sentinel's shell with the right element | 2 Clear element crystals |
| 3 | Order Matters | Forward flow; before vs after a multiplier | Hit 3 dummies at once, then do it at half the drain | Twinspar |
| 4 | When Elements Meet | Core and coat reactions | Make Steam, then Boiling Jet, from the same two crystals | Codex reaction page |
| 5 | Wood and Fire | Material harmony and clash | Win using a clash on purpose (Fire in Willow for steam) | A spare Willow shaft |
| 6 | Too Much Heat | Heat, Stability, overload table | Overload safely 3 times; get one Wild surge | Amethyst hilt |
| 7 | The Side Socket | Flank sockets and halos | Fit a Catalyst flank and double a reaction | A wand with a flank |
| 8 | Echoes in the Wood | Feedback loops, Resonator, Dampener | Build a 2-loop shot that does not overload | Resonator |
| 9 | Two Hands | Off-hand wards, hand swap, cross-current | Fire through your own ward to change your shot | Starting off-hand upgrade |
| 10 | Your Mark | Your class mark reacting with elements | Trigger all four of your mark's reactions | First skill point |
| 11 | The Replica | Legendary resonances and the Codex | Find the hidden resonance of a replica legendary | Codex legendary page |

Lessons 1–4 are required (about 15 minutes); 5–11 unlock as you play and can be done any time, so experienced players are never stuck in a long tutorial.

### Free practice materials

In the Hollow, every material, part and crystal you have **ever discovered** is free and unlimited as a glowing practice copy. Practice copies cannot leave the Hollow and earn no levels or attunement, so they never replace real loot.

- **Always free from the start:** the 6 woods, Chalk, Copper and Basalt; the 4 elements; 12 basic modifiers (Sunstone, Twinspar, Prismite, Swiftquartz, Lancet, Ricochet, Nova Pearl, Lingerite, Thriftstone, Wellspring, Null Stone, Dampener).
- **Unlocked by discovery:** anything you have picked up or seen in the Codex, at every quality tier you have found.
- **Legendaries:** only replicas of legendaries you own, plus the tutorial replica (the Ouroboros Opal), so their secrets are still earned in the world.
- **Blueprints:** save a practice build as a blueprint. Back in the world, "Build from blueprint" fills it from your inventory and highlights what you are missing.

### Sandbox controls

| Control | What it does |
| --- | --- |
| Infinite charge | Fire without draining |
| Heat lock | Turn overloads off, or force a chosen overload result |
| Slow time | 10%–100% speed to watch reactions |
| Packet trace | Step through the 7 resolution steps for one shot, socket by socket |
| Compare | Fire two builds side by side at identical dummies |
| Terrain toggles | Grass, water, rock, height, day/night, rain, storm |
| Reset | Restore the range and dummies |

### Test dummies

| Dummy | What it tests | Behavior |
| --- | --- | --- |
| Straw Dummy | Raw damage, damage per second | Stands still; shows a live damage log |
| Stone Sentinel | Earth, armor break, Stone Bite | Heavy shell that must crack first |
| Iron Knight | Metal armor and magic wards | Plate armor and a ward bubble; Cold Iron tips shine |
| Wisp Lantern | Spirit Bite, accuracy | Floats and phases out every few seconds |
| Treant Stump | Fire, Plant Bite | Regrows health unless burning |
| Ember Golem | Element switching | Immune to Fire; forces a second element |
| Puddle Post | Soak, Storm chains | Stands in water; always Soaked |
| Rat Crate | Area, chain and spread effects | Releases 20 fast tiny rats |
| Rail Cart | Speed, homing, leading shots | Moves on rails at adjustable speed |
| Kite Dummy | Flyers, Wind | Flies in loops above the range |
| Bulwark | Ricochet, lobs, Earth walls | Hides behind walls it raises |
| Mirror Mage | Off-hand wards and reflection | Throws your shots back at you |
| Duelist Echo | The full build | A ghost copy of your current wands that fights you |
| Boss Effigy | Endurance and adaptation | Three phases that change resistances |

**Dummy settings:** health (infinite or set), resistances per element, distance, group size, passive or attacking, and whether they wear a class mark (so you can test mark reactions).

**Readouts on every hit:** element tags, reaction name, mark triggered, Bite multiplier, damage, drain, Heat, and charge per second. The prototype's first stage (Wand Lab) is this Hollow in miniature: a bench, the sandbox controls and the first six dummies.

## Engine choice

**Preliminary: a browser prototype in TypeScript + Three.js. Final: Godot 4.7 (latest stable 4.7.2, Aug 2026).** The browser gets the wand rules right fast; Godot carries them into a full isometric 3D game that Claude can build and maintain entirely as text files.

### The four candidates

| Engine | Cost | Can Claude write every file? | Look on an RTX 4090 | Verdict |
| --- | --- | --- | --- | --- |
| Three.js (browser) | Free | Yes, all code | Good; limited by the browser | **Preliminary** |
| Godot 4.7 | Free, MIT, no royalties | Yes: scenes, scripts and resources are plain text | Very good: Forward+ renderer, global illumination, volumetric fog, GPU particles | **Final** |
| Unity 6 | Free under $200,000 revenue and funding; no runtime fee | Mostly, but scenes and prefabs are fragile to edit without the editor | Very good | Strong runner-up |
| Unreal Engine 5 | Free until $1M gross per title, then 5% | No: Blueprints and assets are binary | Best by far | Too heavy for a hands-off workflow |

The 4090 has headroom for any of them. The deciding factor is the workflow: you give direction, and Claude writes the files and pushes them to GitHub. Godot is the only full 3D engine where every scene, script and setting is readable text, so nothing needs hand-clicking in an editor.

### Why a browser prototype first

- **Instant to test.** Every version opens as a link, on any device, with no install.
- **The hard part is the rules, not the graphics.** Order, flanks, reactions, Heat and feedback need hundreds of test-fires to tune.
- **Same path as Wandlight Woods**, so the workflow is already proven.

### Prototype stages

1. **Wand Lab** — no world. A wand bench, a firing range and dummies. Build a wand, see the full stat readout and shot preview, fire, read the damage log. Starts with 6 materials, 4 elements, 12 modifiers, flanks and Heat.
2. **Duel Lab** — both hands, ward reading, cross-current, hand swap.
3. **Isometric arena** — one small 3D map with grass, water, rock and height; terrain reactions and draw sources; a few enemy types.
4. **Class slice** — two classes (Pyromancer and Tidecaller), their marks, a small piece of the radial tree, and one legendary with a hidden resonance.

### When to move to Godot

Move once all four are true:

- The 7-step shot resolution works with about 20 crystals and gives results that feel right.
- Dual wands and at least one class mark are fun in the arena.
- The browser starts to strain: hundreds of projectiles plus burning, flooding terrain at once.
- The next needs are saves, inventory, a larger world and real art, where an engine pays off.

### Keeping the work portable

The prototype is built in three layers so the move to Godot is a translation, not a rewrite:

| Layer | Contents | Moves to Godot as |
| --- | --- | --- |
| Data | Materials, crystals, legendaries, classes, skill-tree nodes as JSON files | The same JSON files, unchanged |
| Rules | Shot resolution: packet, order, flanks, reactions, Heat, feedback; pure logic, no graphics | Ported to GDScript line for line |
| Presentation | Camera, models, effects, input, UI | Rebuilt with Godot nodes, particles and UI |

**Golden builds.** The example builds in this doc (Scalding Lance, Storm Shepherd, the two Basalt orders, and so on) become automated tests with expected outputs. They run in both versions, so the Godot port must produce exactly the same shots as the prototype.

### Godot setup for the final game

- Forward+ renderer to use the 4090: dynamic lights from every spell, volumetric fog for steam and dust, GPU particles for fire, rain and sparks.
- GDScript for gameplay; C# only if a hot spot proves too slow.
- Pooled projectiles and multi-mesh instancing so hundreds of shots stay smooth.
- Export to Windows first; Steam later if you want to share it.

Sources: [Godot releases](https://github.com/godotengine/godot/releases) · [Unity pricing changes](https://unity.com/runtime-fee) · [Unreal Engine license](https://www.unrealengine.com/en-US/license)
