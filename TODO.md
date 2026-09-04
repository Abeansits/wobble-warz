# Wobble Wars — finish list

MVP loop is playable. This pass is spec art, lighting, and the units that still look like scaled people.

## 1. Grok-generated assets (§9.2)
- [x] Face sprite sheet 4×4 (idle / angry / hurt / dead)
- [x] Particle tiles (dust, spark, smoke, star, ring, confetti, snow, feather)
- [x] Cloud sprites (4)
- [x] Faction emblems (6)
- [x] Logo
- [x] UI icon sheet
- [x] Prop textures: wood, stone, metal
- [x] Roll decals (rarity burst, NEW)
- [x] Wire them under `public/assets/` + runtime loaders
- [x] `public/assets/manifest.json`

## 2. Lighting (§9.1)
- [x] Warm sun, 2048² PCF shadows (1024² on low)
- [x] Cool hemisphere fill, ACES, exposure ~1.1
- [x] Bloom 0.9 + vignette + SMAA
- [x] Settings toggle for shadow quality

## 3. Weird units
- [x] Mammoth reads as a beast (body, 4 legs, trunk, tusks)
- [x] Stagecoach, cannon, catapult, boulder, jelly, hen silhouettes

## 4. Check + ship
- [x] Typecheck, sim tests, browser smoke
- [ ] Push to git
