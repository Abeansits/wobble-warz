# Wobble Wars — finish list

Playable hot-seat + ladder + roll exist. Spec v1.1 (`attachments/wobble-wars-spec.md`). Pillars: slapstick, first impression, fast loop, readable chaos. Auth/db/online/mobile stay out.

Pass-screen 3s curtain stays **skipped** (player asked). Everything else below is still open.

## Wave A — the fight has to be funny (slapstick)

- [x] Pose table: idle sway, run cycle, attack swing into `DriveToPoseUsingMotors` (weak motors)
- [x] Launch feel: spring/motors off in flight; root re-snaps to pelvis on land
- [x] Real beast/vehicle skeletons (mammoth 4 legs, coach wheels, cannon/catapult static) — visuals already clustered, physics is still a scaled humanoid
- [x] Stagecoach: two gunslingers ride it and spill out alive when it flips
- [x] Gimmicks: Knight armor, Reaper instakill, Mirror reflect, Tax steal, Jelly restitution 0.9, Ice freeze-shatter knockback, Cheer speed aura (spring still skipped)
- [x] Obstacle-avoidance raycast so units don't eat boulders/trenches
- [x] Launch motion trails (cosmetic, team-colored)

## Wave B — first 10 seconds look intentional

- [x] Ghost preview is the actual recipe (facing included)
- [x] Armory turntable + stats/gimmick + locked Anomalies (live 3D, not a 256² RT)
- [x] Roll machine is a real Plinko (Jolt pegs, rarity chosen before drop, color leak, settle then crack). Anomaly: 2s turntable cinematic
- [x] Particle cap 1200 + launch trails (team-colored) on launched units
- [ ] Hitscan tracer line + muzzle flash; freeze/heal/pumpkin splat emitters still thin
- [x] Title demo: mixed Clubber / Lobber / Mammoth vs Squire / Archer / Deckhand
- [ ] ~12 hats (cone + crown only); palettes now include pumpkin/bone/royal/rust/moss/ink
- [x] Armory: stats, gimmick, locked Anomalies, equipped cosmetics visible on the turntable

## Wave C — loop chrome

- [ ] Custom budget field; 6000 warning already exists
- [ ] Shift+click duplicate; formation brush already works
- [x] Pause menu: resume / rematch / surrender / settings / quit
- [x] Results: animated credit counter; Roll button only if ≥ 200
- [x] Powerup chips: opponent sees "P2 is using N" not which (unless blind off)
- [x] NEW badge on freshly rolled Anomaly cards
- [x] 10-roll bundle (1800); daily first-battle +50
- [x] Settings: master volume, corpse lifetime (persisted; sim still 6s)
- [x] Ladder 16–20 include Anomalies as a preview
- [ ] Canyon: shootable rope-bridge planks; Graveyard: wet-grass low-friction patch

## Wave D — stay inside the budgets

- [ ] Render interpolation (accumulator alpha)
- [ ] Ragdoll LOD (4-body above 60 alive) + adaptive degrade ⚡
- [ ] Corpse freeze already exists; hard cap 80
- [ ] Zod `UnitDef`; `UnitDef.audio` keys; ban `Math.random` in `sim/`
- [ ] Tests: same-seed determinism 600 steps; every unit 1v1 30s no NaN; stalemate breaker
- [x] `src/game/sim/balance.ts` equal-cost mirrors (vitest smoke 2 rounds); flag >65% still a follow-up printout
- [ ] Spatial SFX (`PannerNode`); per-arena music loop; last-kill duck already sketched
- [ ] Playwright: title → battle canvas, no console errors

## Done (don't redo)

Hot-seat, ladder 1–20, 30 units + 8 anomalies (data), 3 arenas, Jolt puppet-on-a-stick, instanced recipes, spec PNG pack + lighting, facing toward the enemy pad, rematch layout replay, Clear without wasm abort, skippable P1→P2 pass.
