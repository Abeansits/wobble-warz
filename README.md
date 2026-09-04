# Wobble Wars

A browser physics battle simulator. Two players plant wobbly toy soldiers, hit GO, and let ragdolls decide who wins.

## Play

```bash
npm install
npm run dev
```

Title → **Play** (two local profiles) or **Ladder** (vs a preset army).

- Click a unit card, click the glowing pad. Drag for a line. Wheel to face. Right-click to yank. Undo / Flip / Save / Load on the bar.
- **Ready** then pass the keyboard. **GO**.
- Orbit: left-drag. Pan: WASD or shift-drag. **C** cycles views. Click a toy to follow, **F** toggles.
- **Esc** pause. Win credits, then **Roll** (200¢) for powerups, hats, and Anomalies.

## Stack

TanStack Start, React 19, Vite, Tailwind v4, three.js / R3F, Jolt physics, Zustand.

## What’s in

5 factions × 6 units, 8 Anomalies, 3 arenas, ladder 1–20, armory, roll + pity, local profiles (export/import).
