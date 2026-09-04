# WOBBLE WARS — Game Spec v1

*Working title. A browser-native, physics-driven battle simulator in the spirit of Totally Accurate Battle Simulator, with a credits-and-gacha meta layer. Built with Grok Build.*

**Status:** v1.1 spec, ready to build (v1.1: Jolt-first physics with Rapier fallback)
**Author:** Sebas
**Target:** Desktop browser (Chrome/Edge/Firefox, 1080p+), 60 fps
**Stack:** TanStack Start + React 19 + Vite + TS + Tailwind v4 (locked shell) · three.js via @react-three/fiber + drei · Jolt physics (JoltPhysics.js; Rapier is the fallback) · Zustand · localStorage/IndexedDB

---

## 0. How to read this doc

Sections 1–3 are the *what* and the non-negotiables. Sections 4–9 are the detailed design Grok should implement. Section 10 is architecture and performance budgets — treat these as hard constraints, not suggestions. Section 11 is the build order, §12 what v2 is designed for, §13 the risks, and §14 a paste-ready kickoff prompt.

Anything marked **[Grok's call]** is deliberately underspecified — jam on it. Anything marked **[hard]** is a constraint that shouldn't be traded away without asking.

---

## 1. One-liner and pillars

**One-liner:** Two players take turns spending a budget on goofy wobbly units, hit GO, and watch physics decide who wins. Winning earns credits you gamble on rolls for powerups, cosmetics, and rare unique units.

**Pillars (in priority order):**

1. **Emergent slapstick.** The fun comes from ragdoll physics doing unexpected things — a mammoth bowling through a pike line, a bomber blowing up his own side. Every design decision should protect this. If a feature makes battles more predictable, it's suspect.
2. **First-impression polish.** The title screen and the first battle must look *intentional*: cohesive low-poly art, good lighting, satisfying juice (dust, sparks, camera shake, slow-mo on the final kill). No placeholder-looking anything at ship.
3. **Fast loop.** Setup → GO → result → roll → setup again in under 3 minutes. Menus are snappy, battles have a hard cap, results are immediate.
4. **Readable chaos.** Even with 50 units flailing, you can tell who's winning (team colors, HP bars on hover, unit-count bar, kill feed).

**Anti-goals for v1:** online multiplayer, mobile, accounts/backend, a level editor, a story campaign, competitive balance. These are all v2+ or never.

---

## 2. Scope

### In v1 [hard]

- **Hot-seat 2-player**: P1 builds army → "pass the keyboard" screen → P2 builds army (P1's units hidden by default) → GO → battle → results → credits awarded to both local profiles.
- **Vs AI ladder**: 20 preset enemy armies of increasing budget/complexity. Player builds to a matching budget and fights. Solo credit source.
- **Battle**: real-time physics sim with active-ragdoll units, pause/play, speed control (0.25× / 0.5× / 1× / 2×), free orbit camera + follow-cam, hard time limit.
- **Roster**: 5 factions × 6 units = 30 base units, all unlocked from the start, plus 8 gacha-only **Anomaly** units.
- **Meta**: local profiles, credits, a roll (gacha) screen with a drop table and pity timer, powerups consumed at setup, cosmetics (palette swaps + hats).
- **3 arenas** with distinct look and one physical gimmick each.
- **Army save/load** per profile (localStorage).
- **Settings**: master/music/SFX volume, shadow quality, ragdoll corpse lifetime, blind placement toggle, screen shake toggle.

### Explicitly out of v1

- Online play (see §12 — the architecture is designed so P2P over Grok's prewired WebRTC relay is a small step later).
- Accounts, Postgres, server-side anything. Grok deploys to Vercel as a static site; **Railway is not needed for v1.** If v2 adds accounts or a shared leaderboard, Railway can host the API + Postgres and the Vercel frontend calls it.
- Mobile/touch.
- Custom unit creator.
- Replays as shareable files (seeded determinism is in scope; the UI for replays is not).

---

## 3. Player experience walkthrough

*This is the reference for "what does good feel like." Grok should be able to play this exact sequence at M2.*

1. **Title screen.** Camera slowly orbits a live, looping demo battle (two small preset armies, respawning on a timer). Big chunky logo. Menu: *Play*, *Ladder*, *Armory*, *Roll*, *Settings*. Ambient music, distant clunks and yelps from the demo fight.
2. **Play → Profiles.** Pick or create local profiles for P1 and P2 (name + color). Profiles remember credits, unlocks, saved armies.
3. **Setup (P1).** Arena picker at top (3 cards). Budget shown large (default 3000). Left rail: faction tabs → unit cards (portrait, name, cost, 1-line gimmick). Click a card, then click the deployment zone to place; ghost preview follows cursor; scroll wheel rotates; drag to place a line of the same unit (formation brush). Right-click/Delete removes. Ctrl+Z undoes. "Mirror" flips the whole army. "Save army" / "Load army". Big **Ready** button.
4. **Pass screen.** Full-screen "Pass to P2" with a 3-second unskippable curtain so P1 can look away. P2 sets up; P1's zone shows only silhouettes and a total unit count (blind placement, toggleable in settings).
5. **GO.** Curtain lifts, camera pulls back to a wide two-shot, 3-2-1 countdown, units unfreeze. Chaos.
6. **Battle.** Units path toward enemies and fight. Ragdolls tumble, projectiles arc, corpses pile then fade. HUD: team unit-count bars top-center, kill feed left, speed/pause bottom-center, elapsed timer. Player can orbit, pan, zoom, click a unit to follow it, press Space to pause, 1–4 for speed.
7. **Last kill.** Time dilates to 0.2× for 1.5s with a subtle vignette and a camera push-in on the finishing blow. Then **VICTORY — P2** banner in the winner's color.
8. **Results.** Side-by-side: army cost, units lost, damage dealt, MVP unit (most damage), credits earned (animated counter). Buttons: *Roll* (if ≥ roll cost), *Rematch*, *New Armies*, *Menu*.
9. **Roll.** A physical machine on screen — a gumball/capsule dispenser. Pull the lever (click-drag), a capsule drops through physics-simulated pegs, cracks open, reveals the prize with rarity-colored burst. Anomaly reveals get an extra 2s cinematic of the unit doing its thing.
10. **Back to setup.** Powerups appear as chips in a slot bar under the budget; new Anomaly appears in the *Anomalies* faction tab with a "NEW" badge.

---

## 4. Screens and flow

```
Title ─┬─ Play ──── Profiles ── Arena+Setup(P1) ── Pass ── Setup(P2) ── Battle ── Results ─┬─ Roll ─┐
       │                                                                                  ├─ Rematch (same armies, same arena)
       │                                                                                  └─ New Armies (back to Setup P1)
       ├─ Ladder ── Profile ── Level select (1–20) ── Setup(P1 vs preset) ── Battle ── Results ── (unlock next level)
       ├─ Armory ── browse all units, 3D turntable, stats, gimmick, owned cosmetics; equip skins/hats
       ├─ Roll ──── pick profile ── roll machine
       └─ Settings
```

**Route structure (TanStack Start):**
- `/` title (mounts a lightweight R3F canvas for the demo battle)
- `/play`, `/ladder`, `/armory`, `/roll`, `/settings` — DOM screens
- `/battle` — full-screen R3F canvas + DOM HUD overlay; setup and battle are **the same route and the same scene** (setup is the battle scene in a frozen state with placement tools enabled). This avoids a loading hitch on GO.

Game state lives in a Zustand store, not in route params. Navigating away from `/battle` mid-fight prompts "Abandon battle?".

---

## 5. Controls

| Context | Input | Action |
|---|---|---|
| Camera (all) | Left-drag | Orbit |
| | Right-drag or WASD | Pan on ground plane |
| | Wheel | Zoom (clamped) |
| | Middle-click / `F` | Toggle follow selected unit |
| | `C` | Cycle camera presets: Wide / P1 side / P2 side / Top-down |
| | `R` | Reset camera |
| Setup | Click card, click ground | Place unit |
| | Click-drag on ground (card selected) | Formation brush — places units along the drag path at fixed spacing |
| | Wheel while placing | Rotate facing (15° steps) |
| | Right-click unit / `Delete` | Remove |
| | Ctrl+Z / Ctrl+Y | Undo / redo placement |
| | `M` | Mirror army left↔right |
| | Shift+click unit | Duplicate |
| | Enter | Ready |
| Battle | Space | Pause / play |
| | `1` `2` `3` `4` | Speed 0.25× / 0.5× / 1× / 2× |
| | Click unit | Select (shows HP + name), follow with `F` |
| | Esc | Pause menu (resume / restart / surrender / settings / quit) |

Camera is a custom orbit rig, not drei's `OrbitControls` — we need clamped pitch (10°–80°), ground-plane panning bounds per arena, smooth follow with lookahead, and cinematic overrides (GO pull-back, last-kill push-in). drei's `CameraControls` (camera-controls lib) is acceptable as the base if it's wrapped.

---

## 6. Units

### 6.1 The unit model — "puppet on a stick" active ragdoll [hard]

Pure balancing active ragdolls (motors keep a free-standing ragdoll upright) are a research project. We get 90% of the TABS feel with a cheaper trick, and the physics engine choice (§10.2) is made specifically so the library does the hard half of it.

- Each unit has a **root**: a kinematic rigid body (capsule, no rotation) that the AI moves along the ground. It's what pathfinds, has HP, and gets targeted.
- Hanging off the root is a **ragdoll of 6 dynamic bodies**: pelvis, torso, head, left arm, right arm, legs (legs are one body in v1 — two legs doubles joint count for little visual gain; **[Grok's call]** to split if budget allows). In Jolt this is one `RagdollSettings` (a `Skeleton` + per-joint `SwingTwistConstraintSettings` with cone/twist limits) instantiated per unit via `CreateRagdoll` — not hand-built joints.
- The pelvis is attached to the root with a **soft spring** (a `DistanceConstraint` or `PointConstraint` with spring settings, or a 6DOF constraint with a soft position motor). The root drags the body; the body lags, wobbles and leans into turns. That lag *is* the charm. Spring stiffness is a per-unit stat (`springStiffness`).
- Limbs are **driven toward pose targets** with weak motors: Jolt's `Ragdoll.DriveToPoseUsingMotors(pose)` every step, where `pose` comes from a tiny keyframe table per unit state (idle sway, run cycle, attack swing) blended in code. Motor strength is deliberately low so poses are suggestions, not commands. Attack swings are pose changes on the weapon arm, so hits feel physical and can miss.
- **Hit reaction:** damage applies an impulse to the torso + a brief drop in pelvis spring stiffness and motor strength — unit stumbles. Big impulses (mammoth, cannon) exceed `launchThreshold` → **launch state**: root is disabled for N seconds, motors off, unit is fully dynamic and tumbles, then root re-snaps to wherever the pelvis landed if still alive.
- **Death:** root removed, motors off, final impulse applied. Corpse stays 6s (setting), then sinks through the ground and is despawned. Corpses **collide with the living** — pile-ups are a feature.
- Big units (mammoth, stagecoach, cannon) use the same scheme with different skeletons (quadruped: root + body + head + 4 legs, or vehicle: single body + wheels as fixed colliders).

Body-count budget: ~7 bodies and ~6 constraints per humanoid. See §10 for the total.

**If the M0 spike falls back to Rapier** (see §10.2), the same design holds but every joint is hand-rolled: spherical/generic joints with axis locks standing in for swing-twist limits (cone limits on spherical joints have historically been missing in the JS bindings), and pose driving is per-joint `configureMotorPosition` calls. Budget an extra day for tuning in that case.

### 6.2 AI (per unit, simple FSM)

States: `Idle → Seek → Attack → (Stunned | Launched) → Dead`. Ticked at 10 Hz, not every frame.

- **Targeting** (re-evaluated every 0.5s): default nearest enemy root by distance. Tags modify it: `prefer:large`, `prefer:ranged`, `prefer:weakest`, `avoid-melee` (ranged units back off if an enemy is within `keepAway` distance).
- **Movement**: steer toward target with simple separation from friendlies (boid-lite, 2 forces). No navmesh — arenas are open with convex obstacles, steering + obstacle avoidance raycast is enough.
- **Attack**: when target within `range`, face it and trigger the weapon's swing/fire; respect `cooldown`. Melee hitboxes are attached to the weapon body, so units can miss, hit the wrong target, or friendly-fire (friendly fire is on for AoE, off for melee/single projectiles — **[Grok's call]** to tune).
- **Abilities**: cooldown-based, condition-triggered (e.g. Shaman heals when an ally in radius is < 50% HP). Kept declarative in unit data.

### 6.3 Weapon / ability archetypes (implement once, reuse everywhere)

| Archetype | Mechanics | Used by |
|---|---|---|
| `melee` | Motor swing on arm; weapon collider active during swing window; damage + knockback impulse on contact; per-swing hit list so one swing hits once per victim | Clubber, Squire, Deckhand, Brawler, Skeleton… |
| `melee-reach` | Same, long weapon body, slower swing | Pikeman, Bone Brute, Reaper |
| `projectile` | Spawns a dynamic body with initial velocity solved for the target (ballistic arc, lead the target); damage on contact; despawn after 6s | Rock Lobber, Archer, Pumpkin Chucker |
| `hitscan` | Raycast, instant, muzzle flash + tracer line; higher damage, long cooldown | Musketeer, Rifleman, Gunslinger |
| `explosive` | Projectile that on contact/timer applies a radial impulse + damage falloff; hurts everyone | Bomber, Dynamite Dan, Catapult, Cannon |
| `tether` | Raycast hit → spring joint between attacker and victim for 1.5s, then reel-in impulse | Harpooner, Lasso |
| `aura` | Radius check every 0.5s applying a buff/heal/debuff to allies or enemies | Shaman, King, Captain, Scarecrow |
| `charge` | Root accelerates to 3× speed in a line; body collider deals damage+impulse scaled by speed | Mammoth, Stagecoach |
| `phase` | Root ignores unit collision groups; can walk through the fight | Ghost |
| `summon` | Spawns N units of a type at a position on cooldown | Chicken Storm (Anomaly) |
| `status` | Freeze (motors off, root speed 0, blue tint), Burn (DoT), Fear (flee for 2s) | Ice Wizard, Vampire, Ghost |

### 6.4 Unit data schema

Units are pure data in `src/game/data/units/*.ts` validated by a Zod schema. Adding a unit = adding a JSON object + optionally a recipe/hat. No code per unit unless it introduces a new archetype.

```ts
type UnitDef = {
  id: string;                 // 'medieval.knight'
  faction: FactionId;         // 'stoneage' | 'medieval' | 'pirate' | 'frontier' | 'haunted' | 'anomaly'
  name: string;
  blurb: string;              // ≤ 60 chars, shown on card
  cost: number;
  rarity?: 'common' | 'rare' | 'anomaly';
  body: {
    kind: 'humanoid' | 'quadruped' | 'vehicle' | 'static';
    scale: number;            // 1 = human. Mass scales with scale^3 * massMult
    massMult: number;
    hp: number;
    speed: number;            // m/s of the root
    springStiffness: number;  // pelvis→root; lower = wobblier
    launchThreshold: number;  // impulse magnitude that triggers launch state
  };
  weapon: WeaponDef;          // discriminated union over the archetypes above
  abilities?: AbilityDef[];
  ai: { targeting: TargetRule; keepAway?: number; };
  recipe: MeshRecipe;         // procedural low-poly build, see §9
  audio: { attack: string; hit: string; death: string; };
};
```

### 6.5 Roster — 30 base units

Costs are tuned so a default 3000 budget buys roughly 35–50 basic units (Skeleton spam hits the 60 cap) or a handful of big ones. Numbers are starting points, expect to retune after M2 playtests. HP scale: a basic melee unit deals ~20 per hit.

**Stone Age** — cheap, chunky, lots of knockback. Palette: ochre, bone white, moss.

| Unit | Cost | HP | Weapon | Gimmick |
|---|---|---|---|---|
| Clubber | 60 | 100 | melee, club, dmg 22, big knockback | Baseline brawler, hits send people flying |
| Rock Lobber | 90 | 80 | projectile, boulder, dmg 35, slow arc | Boulders stay as physics objects for 4s — terrain hazards |
| Spear Chucker | 120 | 90 | projectile, spear, dmg 40, flat fast arc | Spears pin into the ground; high single-target damage |
| Bone Brute | 260 | 300 | melee-reach, femur, dmg 60, slow | Sweeping two-hander, hits multiple |
| Shaman | 300 | 90 | projectile weak, + aura heal 8/s r=4 | Support; `avoid-melee` |
| Mammoth | 950 | 1600 | charge, dmg 90 + massive impulse; trample | The bowling ball. Slow turn radius, can be baited |

**Medieval** — the balanced faction. Palette: steel, royal blue, red heraldry.

| Unit | Cost | HP | Weapon | Gimmick |
|---|---|---|---|---|
| Squire | 80 | 120 | melee, sword, dmg 20 | Reliable |
| Archer | 140 | 80 | projectile, arrow, dmg 25, fast, 1.2s cd | Volleys; `avoid-melee` |
| Pikeman | 170 | 130 | melee-reach, pike, dmg 30 | `prefer:large`; 3× damage to `charge` units mid-charge (the mammoth counter) |
| Knight | 450 | 500 | melee, longsword, dmg 35 | Armor: 40% less damage from projectiles; heavy (massMult 1.6), hard to launch |
| Catapult | 700 | 350 | explosive, boulder, dmg 80 r=3, 4s cd | Static; min range 8m — useless if rushed |
| King | 1200 | 700 | melee, dmg 30; aura +25% dmg allies r=6 | Taunt: enemies within 10m `prefer` him. Losing him is bad. |

**Pirates** — gunpowder and grabs. Palette: navy, weathered wood, gold.

| Unit | Cost | HP | Weapon | Gimmick |
|---|---|---|---|---|
| Deckhand | 80 | 110 | melee, cutlass, dmg 20 | Slightly faster than Squire |
| Bomber | 180 | 90 | explosive, bomb, dmg 60 r=2.5, 3s cd | Bombs bounce; hurts own team; **the comedy unit** |
| Musketeer | 220 | 90 | hitscan, dmg 90, 4s cd, range 25 | Long reload, big hit, knocks target down |
| Harpooner | 260 | 130 | tether then melee | Yanks a target out of formation — pulls a King into your mob |
| Cannon | 600 | 300 | explosive, dmg 120 r=3, 5s cd, flat trajectory | Static, ball ricochets through lines |
| Captain | 900 | 450 | hitscan pistol dmg 45 + melee; aura +30% speed r=6 | Rally; fast pirate swarms |

**Frontier** — fast, fragile, high damage. Palette: dust, denim, brass.

| Unit | Cost | HP | Weapon | Gimmick |
|---|---|---|---|---|
| Brawler | 90 | 130 | melee, fists, dmg 15, fast, big upward knockback | Uppercuts launch small units |
| Dynamite Dan | 220 | 90 | explosive, dmg 70 r=3, 2.5s fuse | Fuse timer; can be knocked back onto his own side |
| Lasso | 200 | 100 | tether (longer range) | `prefer:ranged` — drags snipers into melee |
| Gunslinger | 260 | 90 | hitscan, dmg 30, 0.6s cd | DPS glass cannon |
| Rifleman | 320 | 90 | hitscan, dmg 110, 5s cd, range 35 | Longest range in game; `prefer:large` |
| Stagecoach | 850 | 900 | charge, dmg 60 + impulse; carries 2 Gunslingers who fire from it | Vehicle body; wheels; flips on a big enough hit and the gunslingers spill out alive |

**Haunted** — swarm and weirdness. Palette: violet, sickly green, black.

| Unit | Cost | HP | Weapon | Gimmick |
|---|---|---|---|---|
| Skeleton | 45 | 50 | melee, bone, dmg 15 | Cheapest unit; bones scatter dramatically |
| Scarecrow | 150 | 250 | none; aura Fear r=5 on enemies every 6s | Tanky decoy; `taunt` |
| Pumpkin Chucker | 180 | 80 | projectile pumpkin, dmg 30, splats to slow (60% speed 2s) | Area slow |
| Ghost | 220 | 120 | melee touch, dmg 10 + Fear | `phase`; walks through the front line to the archers |
| Vampire | 420 | 300 | melee, dmg 30, heals 100% of dmg dealt | Sustain; weak to being launched (breaks contact) |
| Reaper | 1500 | 400 | melee-reach scythe, **instakill** on hit, 2.5s swing, very slow | Terrifying and slow; kited by anything ranged |

### 6.6 Anomalies — 8 gacha-only uniques

Unlocked permanently per profile via rolls. Strong, weird, expensive. Balance goal: an Anomaly should change *how* you build, not just win.

| Unit | Cost | Gimmick |
|---|---|---|
| Jelly Titan | 1100 | Huge, 2000 HP, deals only 10 dmg but every hit is a massive upward launch. Bouncy restitution 0.9 on its body. |
| Chicken Storm | 500 | `summon`: spawns 6 chickens (10 HP, 5 dmg, fast, tiny) every 8s. Chickens are physics chaos. |
| Ice Wizard | 700 | Projectile that Freezes in r=3 for 3s. Frozen units shatter if hit while frozen (2× dmg). |
| Mirror Knight | 800 | Reflects projectiles that hit its shield collider back along their incoming vector. |
| Black Hole Bard | 900 | Every 10s: pulls all enemies within r=8 toward him for 2s, then releases with an outward impulse. |
| The Cheerleader | 350 | Aura: allies in r=6 have +50% springStiffness (stumble less) and +15% speed. Fragile. |
| Boulder Boy | 650 | Spawns as a 3m boulder that rolls toward the nearest enemy. It's just a boulder. Dmg scales with speed. |
| Tax Collector | 1000 | On hit, steals 5% of the victim's max HP permanently and adds it to his own. Snowballs. |

**[Grok's call]:** rename freely, swap up to 3 of these for better ideas, keep the count at 8 and keep each one tied to a single physics gimmick.

### 6.7 Battle rules

- **Budget**: default 3000 per side (setup screen offers 1500 / 3000 / 6000 / Custom; 6000 shows a "may drop below 60 fps" warning).
- **Unit cap**: 60 placed units per side [hard]. Summons don't count toward placement but are capped at 30 alive per side.
- **Win**: all enemy units dead (summons included). Units are "dead" at HP ≤ 0; a unit launched out of the arena bounds dies after 3s out of bounds.
- **Time limit**: 120s of sim time at 1×. At the limit, the side with more **remaining HP as a % of starting HP** wins; a true tie is a draw (both get loss credits + 20).
- **Stalemate breaker**: if no damage has been dealt for 15s (e.g. two static Catapults out of range), all units get +50% speed and ranged units lose their `keepAway` — they walk at each other.
- **Speed**: 0.25× / 0.5× / 1× / 2× change the fixed-step accumulation rate, not the timestep (see §10) so results are identical at any speed. Pause is speed 0.

### 6.8 Presets for the Vs-AI ladder

20 hand-authored armies in `src/game/data/ladder.ts`. Level N budget ≈ 800 + N × 150 (L1 = 950, L20 = 3800); player gets the same budget. Every 5th level is a "boss" (a single big unit + escort). Levels 1–5 introduce factions one at a time. Levels 16–20 include Anomalies in the enemy army (a preview of what you can roll). Credits reward = 60 + N × 12 on first clear, half on repeat clears.

---

## 7. Arenas

Three arenas, each with one physical gimmick so the same army plays differently. All are ~60 m × 40 m, open, with a P1 zone (left third), neutral middle, P2 zone (right third). Arenas are procedural low-poly terrain (heightmap → smoothed mesh with flat-shaded triangles) with a handful of convex prop colliders.

| Arena | Look | Gimmick |
|---|---|---|
| **Highland Meadow** | Rolling green hills, wildflowers, a few boulders, big soft clouds, warm afternoon sun | Gentle slope from P1 to P2 (2 m rise) — charges downhill hit harder, uphill slower. Boulders are dynamic and can be dislodged by mammoths/cannons. |
| **Sunset Canyon** | Red rock, mesas, dust haze, low golden-hour sun, long shadows | A dry riverbed trench across the middle (1.5 m deep, 6 m wide). Melee has to go down-and-up; ranged units on the rims get a height bonus (+15% range). Two rope bridges (dynamic planks, can be shot out). |
| **Hollow Graveyard** | Night, fog, moonlight, crooked tombstones, dead trees, lanterns | Tombstones are breakable static props (become debris). Low friction "wet grass" patch in the center — units slide when launched. Fog hides the far side until units close in (visual only). |

Arena defs live in `src/game/data/arenas/*.ts`: heightmap params, prop placements, deployment zone bounds, camera bounds, sky/lighting preset, ambient audio loop.

---

## 8. Meta: profiles, credits, rolls, powerups, cosmetics

### 8.1 Local profiles

`profiles: Record<ProfileId, Profile>` in localStorage (Zustand `persist` middleware; if size grows past ~2 MB move to IndexedDB via `idb-keyval`). A profile: `{ id, name, color, credits, unlockedAnomalies[], cosmetics[], powerups: Record<PowerupId, count>, ladderProgress, savedArmies[], stats, rollCount, pityCounter }`. Both hot-seat players are profiles on the same browser. Export/import profile as JSON for moving between machines (cheap and avoids needing a backend).

### 8.2 Credits

| Event | Credits |
|---|---|
| Hot-seat win | 120 + 5% of enemy army cost destroyed |
| Hot-seat loss | 40 (participation, so the loser keeps rolling too) |
| Ladder first clear | 60 + level × 12 |
| Ladder repeat clear | half |
| Daily first battle bonus | +50 (local clock; not exploit-proof, we don't care) |
| MVP bonus | +20 to the profile whose unit was MVP |

Sanity check: an average hot-seat session (5 battles, both players) yields ~800 credits per player → ~4 rolls. That's the intended cadence: roughly one roll per battle.

### 8.3 Roll machine

- Cost: **200 credits** per roll. 10-roll bundle for 1800.
- Drop table (per roll): 50% Powerup · 30% Cosmetic · 15% Credit refund (50–300, weighted low) · **5% Anomaly**.
- **Pity**: guaranteed Anomaly on the 20th roll without one; counter resets on any Anomaly. Duplicate Anomaly → converts to 400 credits + a cosmetic for that Anomaly.
- Cosmetic duplicates → 60 credits.
- The roll is a real physics moment: a capsule drops through a physics peg board (Plinko), lands in a tray, cracks open. Rarity is decided *before* the drop (no fake RNG tied to physics) but the reveal is gated on the capsule settling. Rarity color leaks through the capsule as it falls so attentive players get a tell. Anomaly reveal: capsule shakes, gold light, 2s turntable of the unit + name card.

### 8.4 Powerups (consumable, chosen at setup, max 2 per battle)

| Powerup | Effect | Weight |
|---|---|---|
| Deep Pockets | +15% budget this battle | common |
| Iron Skin | All your units +20% HP | common |
| Big Boots | All your units +30% springStiffness (harder to knock down) | common |
| Giant | One random unit spawns at 2× scale (8× mass) | rare |
| Reinforcements | 5 Skeletons spawn behind your line at 0:20 | common |
| Second Wind | Your units heal 30% at 0:30 | rare |
| Banana Peel | Opponent's zone gets a low-friction patch | rare |
| Hot Potato | Opponent's most expensive unit starts with a 5s fuse (explodes, non-lethal to itself, launches neighbors) | rare |

Powerups show up as chips under the budget; the opponent sees a "P1 is using 2 powerups" indicator but not which, unless blind placement is off.

### 8.5 Cosmetics

- **Palettes**: per-faction alternate color sets (e.g. Medieval "Midnight", Pirates "Ghost Fleet"). Applied via the recipe's material params — zero extra assets.
- **Hats**: ~12 procedural hats (top hat, crown, traffic cone, propeller cap, bucket, halo…) attachable to any humanoid head. Shared across factions.
- **Team trails**: colored motion trail on launched units.

Cosmetics are pure fun; they never affect stats.

---

## 9. Art direction, assets, audio, VFX

### 9.1 Look: "chunky toybox"

One sentence: **flat-shaded low-poly figures with big heads and tiny legs, lit like a sunny diorama, in saturated-but-matte faction palettes.** Think wooden toy soldiers that came alive, not realistic ragdolls.

Rules that keep it cohesive (these matter more than any single asset):

- **Geometry** is procedural from primitives: capsules, boxes, spheres, cones, cylinders, with `flatShading: true`. Every unit is a `MeshRecipe`: a list of parts `{ body: 'torso'|'head'|'armL'|…, shape, size, offset, color: 'primary'|'secondary'|'accent'|'skin'|'team' }` plus optional attachments (weapon, hat, shield). Heads are ~1.6× "realistic" scale; legs short; hands are spheres. This is what makes 38 units feasible without a modeling pipeline, and it's what makes them wobble legibly.
- **Materials**: `MeshToonMaterial` with a 3-step gradient map, or `MeshStandardMaterial` with roughness 0.9 / metalness 0 — pick one for everything **[Grok's call]**, do not mix. No specular highlights on skin.
- **Palette**: each faction has exactly `primary`, `secondary`, `accent`, `skin`. Cosmetic palettes swap these four. Neutrals (ground, rock, wood) come from one shared 6-step scale. Team identity is a **team-colored cape/scarf/armband** on every humanoid and a team-colored trim ring on vehicles and beasts — because cosmetic palettes must never make it unclear whose unit that is.
- **Faces**: eyes and mouths are small textured quads on the head sphere, driven by state: idle, angry (attacking), hurt (hit flash), dead (X eyes), frozen. This is the single highest-leverage charm feature — do it early.
- **Lighting**: one warm directional sun with a 2048² PCF-soft shadow map (1024² on "low"), one cool hemisphere fill, environment reflections off. ACES filmic tonemapping, exposure ~1.1. Post: subtle Bloom (threshold 0.9) + Vignette + SMAA via `@react-three/postprocessing`. No SSAO, no DoF in battle (a DoF pass on menus/roll screen is fine).
- **Sky**: gradient sky dome (custom shader or drei `Sky` with tuned params) + a few billboarded cloud sprites. Fog color matches the sky horizon per arena.
- **Terrain**: vertex-colored flat-shaded triangles from the heightmap, two-tone color by slope (grass/dirt, sand/rock, grass/mud). No terrain textures needed — but see §9.2.

### 9.2 Grok-generated assets — where they help, where they don't

Grok can generate sprites and textures. Use that for the things that are hard to do procedurally and easy to do as a PNG, and keep everything else procedural so it stays consistent and tweakable.

**Generate these (2D, PNG with alpha, bundled under `/public/assets/`):**

| Asset | Spec | Notes |
|---|---|---|
| Face sprite sheet | 512×512, 4×4 grid, eyes+mouth per state, black/white only | Colorized in shader. One sheet for all humanoids; a second for beasts. |
| Particle sprites | 8 tiles × 128²: soft dust puff, hard spark, smoke blob, star, ring shockwave, confetti strip, snowflake, feather | White on alpha; tinted at runtime |
| Cloud sprites | 4 × 512×256 soft cumulus, white on alpha | Billboards on the sky dome |
| Faction emblems | 6 × 256² flat vector-style icons: skull-and-club, crowned shield, crossed cutlasses, sheriff star, jack-o'-lantern, a "?" glitch glyph | Used on tabs, cards, capes |
| Logo | 2048×768 chunky lettering with a 3D-extruded look, transparent bg | Title screen + favicon crop |
| UI icons | 24 × 64² : credits coin, HP heart, speed, pause, camera, hat, palette, lock, dice… | Single-color, tinted with `currentColor` if SVG is possible instead |
| Prop detail textures | 3 × 512² tileable: weathered wood, cracked stone, rusted metal | Only on props (bridges, tombstones, cannon). Terrain stays vertex-colored. |
| Roll machine decals | Rarity burst (4 colors), "NEW" badge, capsule labels | |
| Ladder level cards | 20 × 512×288 painterly thumbnails of the enemy army silhouette against the arena | Nice-to-have; can be runtime-rendered instead |

**Don't generate these — do them at runtime:**

- **Unit portraits** for cards and the Armory: render each unit's recipe to a 256² render target at boot (or on first view) with the same lights as the battle. Portraits then always match the model, cosmetics show up automatically, and there's no drift between the 2D card and the 3D unit.
- **Terrain textures, unit textures, skins.** Vertex color + flat shading is the look; textures would fight it.

**[Grok's call]:** If Grok wants to push the style further (painted skybox instead of a gradient, hand-drawn hit VFX, a texture-atlas approach to faces), it's welcome to — the rule is that anything generated must sit inside the faction palettes and the flat-shaded toybox look. If a generated asset makes the procedural units look cheap next to it, the asset loses, not the units.

### 9.3 UI

- Tailwind v4 with design tokens in `@theme`: two fonts max — a display face for headings and numbers (Lilita One, Rubik Black, or Bungee — **[Grok's call]**, self-hosted) and Nunito or Inter for body. Radius 16 px on cards, 12 px on buttons. Thick 3 px borders in a dark neutral, **hard offset shadows (4 px, no blur)** — toybox, not glassmorphism. Buttons squash on press (scale 0.96).
- Each faction tab tints its accent. Unit cards: portrait, name, cost pill, one-line gimmick, rarity edge glow for Anomalies.
- HUD in battle is minimal and semi-transparent; nothing covers the center 60% of the screen.
- Screen transitions are 200–300 ms, never longer. Curtain wipe for the pass screen.
- No modal spam: confirmations only for destructive things (abandon battle, delete profile, delete saved army).

### 9.4 Audio

- **Web Audio** graph: master → music / sfx buses → per-sound `PannerNode` positioned relative to the camera so battles have left/right and near/far.
- **SFX source [Grok's call]:** either synthesize at load with a tiny procedural synth (ZzFX-style: whooshes, clunks, pops, whistles are all achievable and weightless), or bundle CC0 samples (Kenney's Impact/Voice packs are the obvious pick). Recommended: synth for impacts/projectiles/UI, a small sample set for unit yelps and death groans. Every SFX gets ±10% random pitch. Cap 24 concurrent voices with oldest-steals.
- **Music**: one loop for menus, one per arena (3), a short victory sting. CC0 or generated. Ducks −6 dB during the last-kill slow-mo.
- Unit-specific: each `UnitDef.audio` references keys; big units get a low-pass thump on footsteps.

### 9.5 VFX and juice

- One CPU-updated `InstancedMesh` particle system (≤ 2000 live particles, sprite-sheet UVs per instance). Emitters: landing dust, melee hit spark, explosion smoke+ring+sparks, muzzle flash + tracer line, freeze crystals, heal sparkles, pumpkin splat, feathers (chickens).
- **Hit-stop**: 40–60 ms sim pause on hits above an impulse threshold, scaled by camera distance.
- **Camera shake**: perlin-driven, amplitude by impulse × 1/distance², off in settings.
- **Hit flash**: unit materials flash to white for 60 ms on damage (per-instance color, no material swap).
- **Last-kill slow-mo** and **GO pull-back** as described in §3.
- Floating damage numbers: implemented, **off by default** (they read as RTS, not slapstick).
- Corpse fade: sink 0.5 m and scale to 0 over 0.6 s.

---

## 10. Architecture and performance [hard]

### 10.1 Layering

```
src/
  routes/                 TanStack routes: /, /play, /ladder, /armory, /roll, /settings, /battle
  game/
    sim/                  HEADLESS. No React, no three. Runs in Node for tests.
      World.ts            owns the physics world (Jolt), entity arrays, fixed-step loop, seeded RNG, event ring buffer
      units/              UnitRuntime, ragdoll builder, FSM
      weapons/            one module per archetype (§6.3)
      abilities/
      arenas/             terrain heightmap gen + prop colliders (geometry shared with render)
      events.ts           SimEvent union: Spawn, Hit, Death, Launch, Projectile, Explosion, Status…
    data/                 units/*.ts, anomalies.ts, arenas/*.ts, ladder.ts, powerups.ts, cosmetics.ts (Zod-validated)
    render/               R3F. Reads sim state, never writes it.
      InstancedParts.tsx  one InstancedMesh per (part shape × material) — all units
      Terrain.tsx, Sky.tsx, Props.tsx, Particles.tsx, Faces.tsx, Portraits.ts (render-to-texture)
      CameraRig.tsx       orbit/pan/zoom/follow/cinematics
    audio/                bus graph, synth, sample loader, event→sound mapping
    meta/                 profiles, credits, roll logic, powerups, cosmetics (pure functions + persistence)
  store/                  Zustand: profiles, session, battle (10 Hz snapshot), settings
  ui/                     Tailwind components: cards, HUD, screens
public/assets/            Grok-generated PNGs + manifest.json
```

The single most important rule: **the sim is a pure, headless module.** `new World(seed, arena, [armyP1, armyP2], modifiers)` → `step(dt)` → read `world.bodies` + drain `world.events`. React and three are consumers. This buys us: headless tests, a balance harness, deterministic replays, a trivial path to a Web Worker, and a trivial path to P2P online (§12).

### 10.2 Simulation loop

- Fixed timestep **1/60 s**. Accumulator pattern; speed multiplier scales how much wall time is fed into the accumulator. Max 4 steps per frame, then drop time (prevents spiral of death; if this triggers regularly, that's a perf bug).
- Rendering interpolates between the previous and current sim state by the accumulator alpha, so 0.25× is silky rather than 15 fps-looking.
- **Physics engine: Jolt via `jolt-physics` (JoltPhysics.js), used directly.** Chosen over Rapier for three reasons: it has first-class ragdolls (`RagdollSettings`, `Ragdoll`, `DriveToPoseUsingMotors`, swing-twist constraints) so §6.1 is mostly library calls; it handles high body counts better; and it is deterministic across platforms by design, which is what v2 online needs. Costs: an Emscripten-style API where every object you `new` must be `Jolt.destroy()`ed (leaks and crashes are the failure mode — wrap allocations in helpers, pool temp vectors), a ~2 MB wasm, thinner JS docs than Rapier. **M0 is the spike**: if a motor-driven Jolt ragdoll isn't standing, walking on its root and swinging within ~a day of effort, fall back to `@dimforge/rapier3d-compat` behind the same `sim/` interface and note it in the summary.
- **No React physics wrappers for units.** Not `react-three-jolt`, not `@react-three/rapier`. At 500+ bodies the per-component reconciliation and subscriptions are the bottleneck. A wrapper is fine for the roll machine (a few dozen bodies) if it's the same engine.
- Keep engine-specific code inside `sim/physics/` behind a thin adapter (`createBody`, `createRagdoll`, `driveToPose`, `applyImpulse`, `raycast`, `step`, `readTransforms`). Don't over-abstract — this is so the fallback is a swap, not a rewrite, and so tests can mock it.
- AI ticks at 10 Hz, staggered across units (unit i ticks on step `i mod 6`).
- Seeded RNG (`mulberry32`) for everything in the sim: projectile spread, AI target ties, ability jitter. `Math.random` is banned inside `sim/` (lint rule).
- Deterministic creation order: units sorted by (side, placement index) before insertion; joints/bodies created in a fixed order per recipe.

### 10.3 Budgets

| Budget | Target | Hard ceiling |
|---|---|---|
| Frame time at 1080p on a 2020 laptop (M1 / i5 + iGPU) | 16.6 ms (60 fps) with 80 alive units | 33 ms with 120 |
| Physics step | ≤ 7 ms avg | 10 ms |
| Render | ≤ 6 ms | 9 ms |
| AI + game logic | ≤ 1 ms | 2 ms |
| React work per frame | 0 (HUD updates at 10 Hz from a store snapshot) | — |
| Draw calls in battle | ≤ 60 | 100 |
| Dynamic rigid bodies | ≤ 700 | 1000 |
| Live particles | 2000 | — |
| Initial JS bundle (gz) | ≤ 2 MB incl. physics wasm (Jolt is ~2 MB uncompressed; lazy-load it on the title screen behind the logo) | 3 MB |
| Total assets | ≤ 8 MB | 15 MB |

### 10.4 How we stay inside them

- **Instanced rendering**: every unit part shares a small set of geometries. One `InstancedMesh` per (shape, material) with per-instance color and a per-instance "flash" attribute. Faces are one more instanced quad batch. Result: all 100 units in ~20 draw calls.
- **Ragdoll LOD**: full 7-body ragdoll while ≤ 60 total alive units; above that, newly spawned/summoned units get a 4-body ragdoll (pelvis+torso, head, arms as one, legs as one). Player-placed units never downgrade mid-battle.
- **Corpse management**: 1 s after death, once the ragdoll's velocity is under threshold, convert bodies to `fixed` (they still block the living, cost ~0). Despawn at corpse lifetime. Hard cap 80 corpse ragdolls; oldest fade early.
- **Projectiles**: pooled; cap 150 live; ballistic ones are `ccd` enabled so fast arrows don't tunnel.
- **Collision groups**: unit bodies don't self-collide within a ragdoll; friendly ragdolls collide only pelvis-to-pelvis (prevents the "everyone tangles into a ball" failure mode); corpses collide with everything.
- **Shadows**: single cascade, shadow camera fitted to the arena bounds; "low" halves the map.
- **Adaptive**: if the physics step averages > 8 ms over 2 s, the sim flips a `degraded` flag: LOD threshold drops to 40, corpse lifetime halves, particle cap halves. HUD shows a tiny "⚡" indicator. Never silently changes outcomes for placed units.
- **Web Worker** (M4 stretch): because `sim/` is headless, moving it into a worker is: worker owns `World`, posts a `Float32Array` of body transforms per step (or writes into a `SharedArrayBuffer`), main thread renders. Only do this if main-thread step time is > 6 ms after the optimizations above. Vercel needs COOP/COEP headers for SAB — `postMessage` with transferables is the fallback.

### 10.5 Persistence

- Zustand `persist` → `localStorage` for `profiles` and `settings`. Version field + migration function from day one.
- Saved armies are `{ name, arenaId?, budget, units: { defId, x, z, yaw }[] }` — small.
- Profile export/import as a JSON download/upload (client-side only).
- Nothing is written server-side. No env vars, no secrets, no API routes in v1.

### 10.6 Testing and the balance harness

- `vitest` on `sim/`: determinism test (same seed → identical body transforms after 600 steps), smoke test (every unit × every unit 1v1 for 30 s doesn't throw or NaN), stalemate breaker test.
- `scripts/balance.ts`: runs faction mirror matches and round-robins at equal budget N times headlessly, prints win rates and average time-to-kill per unit. Grok should run this after adding or tuning units and flag anything with a > 65% win rate at equal cost. This is how we tune 38 units without a QA team.
- Playwright smoke: title loads, can reach `/battle`, canvas has a WebGL context, no console errors.

---

## 11. Milestones and acceptance

Build in this order. Each milestone is playable and demoable; don't start the next until the acceptance line is green.

**M0 — Physics proof (1 arena, 2 units)**
Highland Meadow terrain, Clubber and Squire, place by clicking, GO, they walk to each other and fight, the loser ragdolls. Orbit camera, pause, speed. Faces with idle/angry/dead.
*Accept:* Jolt ragdolls standing on their roots, walking and swinging via `DriveToPoseUsingMotors` (or the documented Rapier fallback); 40 v 40 Clubbers at 60 fps on the dev machine; a Mammoth-strength test impulse launches a unit believably; determinism test passes; no wasm memory growth over a 5-minute battle (leak check).

**M1 — Full hot-seat loop (2 factions)**
Profiles, setup UI with faction tabs and formation brush, pass screen with blind placement, battle HUD, win/timeout rules, results screen with credits, rematch. Stone Age + Medieval complete (12 units), all archetypes they need (`melee`, `melee-reach`, `projectile`, `explosive`, `aura`, `charge`).
*Accept:* two people can play 5 rounds in a row without touching the URL bar; credits persist across reload.

**M2 — Content and first-impression polish**
Remaining 3 factions (18 units) and archetypes (`hitscan`, `tether`, `phase`, `status`), all 3 arenas with gimmicks, Vs-AI ladder with 20 presets, Armory, title-screen demo battle, post-processing, particles, hit-stop, shake, last-kill slow-mo, audio pass, Grok-generated asset pass, settings.
*Accept:* someone who has never seen the project watches the title screen and one battle and says "oh that looks nice" unprompted. Balance harness shows no faction mirror-match asymmetry and no unit > 65% at equal cost.

**M3 — Meta layer**
Roll machine with physics, drop table, pity, 8 Anomalies, powerups applied at setup, cosmetics (palettes + hats) equippable in Armory, profile export/import.
*Accept:* a player can go from 0 credits → ladder → roll → Anomaly → use it in hot-seat. Roll feels good enough that people want to pull the lever again.

**M4 — Performance and hardening**
Ragdoll LOD, corpse freezing, adaptive degrade, bundle size, Playwright smoke, Web Worker if needed, low-end shadow settings, edge cases (abandon mid-battle, deleting active profile, 6000 budget warning).
*Accept:* budgets in §10.3 hold on a 2020 laptop; no console errors in a 30-minute session.

---

## 12. v2 candidates (designed for, not built)

- **Online 1v1 over the prewired WebRTC P2P relay.** Because the sim is deterministic and headless, online play is *not* netcode: both clients exchange `{ armyJSON, powerups }` and agree on a seed, then run the same sim. Two messages per match. The only real requirement is cross-machine determinism, which Jolt gives us by design (see risk 3). Hot-seat's blind placement already maps to this.
- **Shared leaderboard / accounts** — this is where Railway earns its keep: a small API + Postgres, Vercel frontend calls it. Not before there's a reason.
- **Daily challenge**: fixed seed, fixed enemy army, everyone builds against it; compare results by damage dealt.
- **Replay files**: `{ seed, armies, arena }` is already a complete replay. Add a UI and a share link.
- **Unit creator** (recipe editor exposed to players) and **workshop sharing**.
- **Spectator "director" cam** that auto-cuts to the most interesting cluster.

---

## 13. Risks and honest notes

1. **Ragdoll tuning is the whole game.** The "puppet on a stick" model avoids the balance problem, but getting the spring stiffness, motor strength and launch threshold to feel funny rather than floppy or stiff is iterative. Budget real time in M0 for this and don't move on until 40 v 40 Clubbers is already fun to watch. If it isn't fun with two unit types, 38 won't save it.
2. **Physics body count is the perf ceiling.** 60 v 60 humanoids at 7 bodies each is ~840 bodies before projectiles and corpses. Jolt in wasm can do that on a desktop, but not with margin on an iGPU laptop. The LOD, corpse freezing and adaptive degrade in §10.4 are the plan; the default 3000 budget (≈30–40 units a side) is the realistic sweet spot, and 6000 gets a warning for a reason.
3. **Jolt's API is the sharp edge.** It's an Emscripten binding: manual `Jolt.destroy()`, `Vec3` temporaries you must free, and errors that surface as wasm aborts rather than stack traces. The mitigation is a small adapter layer in `sim/physics/` with pooled temporaries and a leak test in M0. Determinism is the upside: Jolt is deterministic cross-platform by design, so v2 online P2P doesn't need a special build. (If we fall back to Rapier: it's deterministic on one machine for one build, and cross-machine needs the `enhanced-determinism` feature that default npm builds may not enable.)
4. **React physics wrappers are a trap at this scale.** `react-three-jolt` and `@react-three/rapier` are lovely for 20 bodies and a wall for 800. The spec says raw engine API in the sim; hold that line.
5. **Grok deploys to Vercel; you have Railway.** Not a conflict for v1 (static site, no backend). It becomes a two-host setup only if v2 adds an API. Fine, just be aware.
6. **Name and IP.** Ship with an original name and original unit names/designs. The mechanics of "place units, press go, physics decides" aren't protectable; TABS's specific unit roster, name and trade dress are. Nothing in this spec copies them, keep it that way.
7. **Scope creep vector: the gacha.** It's fun to design drop tables forever. The meta is M3 for a reason; a great battle with no roll screen beats a great roll screen with a mediocre battle.
8. **38 units via recipes is feasible; 38 *good* units is a content job.** Expect to cut or merge 3–5 units after the balance harness and playtests. That's fine.

