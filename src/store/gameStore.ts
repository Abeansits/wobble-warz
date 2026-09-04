import { create } from "zustand";
import type { FactionId, Placement, UnitDef } from "@/game/data/types";
import type { ArenaId } from "@/game/data/arenas";
import { M1_ROSTER } from "@/game/data/units";
import { clampBudget } from "@/game/setup";
import type { WorldSnapshot } from "@/game/sim/World";

export type Speed = 0 | 0.25 | 0.5 | 1 | 2;
export type SeatPhase = "setupP1" | "pass" | "setupP2" | "fight" | "results";
export type CamBumpKind = "yaw" | "pitch" | "zoom" | "reset" | "shake";

type GameStore = {
  selected: UnitDef;
  faction: FactionId;
  placingSide: 0 | 1;
  seat: SeatPhase;
  budget: number;
  spent: [number, number];
  speed: Speed;
  paused: boolean;
  snapshot: WorldSnapshot | null;
  message: string;
  followId: number | null;
  hoverId: number | null;
  placements: Placement[];
  undo: Placement[];
  yawOffset: number;
  killFeed: string[];
  awarded: boolean;
  arena: ArenaId;
  vsAI: boolean;
  ladderLevel: number | null;
  powerups: [string[], string[]];
  ghost: { x: number; z: number } | null;
  menuOpen: boolean;
  camBump: { id: number; kind: CamBumpKind; value: number } | null;
  setSelected: (u: UnitDef) => void;
  setFaction: (f: FactionId) => void;
  setSeat: (seat: SeatPhase) => void;
  setPlacingSide: (s: 0 | 1) => void;
  setSnapshot: (s: WorldSnapshot | null) => void;
  setSpeed: (s: Speed) => void;
  setPaused: (p: boolean) => void;
  setMessage: (m: string) => void;
  setFollowId: (id: number | null) => void;
  setHoverId: (id: number | null) => void;
  setBudget: (n: number) => void;
  addSpend: (side: 0 | 1, cost: number) => void;
  resetSpend: () => void;
  pushPlace: (p: Placement) => void;
  popPlace: () => Placement | null;
  redoPlace: () => Placement | null;
  setYawOffset: (n: number) => void;
  pushKill: (line: string) => void;
  clearFeed: () => void;
  setAwarded: (v: boolean) => void;
  setArena: (id: ArenaId) => void;
  startLadder: (level: number, budget: number) => void;
  togglePowerup: (side: 0 | 1, id: string) => void;
  setGhost: (g: { x: number; z: number } | null) => void;
  setMenuOpen: (v: boolean) => void;
  bumpCam: (kind: CamBumpKind, value?: number) => void;
  resetMatch: () => void;
};

export const useGame = create<GameStore>((set, get) => ({
  selected: M1_ROSTER[0],
  faction: "stoneage",
  placingSide: 0,
  seat: "setupP1",
  budget: 3000,
  spent: [0, 0],
  speed: 1,
  paused: false,
  snapshot: null,
  message: "P1 — click the glowing blue pad.",
  followId: null,
  hoverId: null,
  placements: [],
  undo: [],
  yawOffset: 0,
  killFeed: [],
  awarded: false,
  arena: "meadow",
  vsAI: false,
  ladderLevel: null,
  powerups: [[], []],
  ghost: null,
  menuOpen: false,
  camBump: null,
  setSelected: (selected) => set({ selected, faction: selected.faction }),
  setFaction: (faction) => {
    const first = M1_ROSTER.find((u) => u.faction === faction) ?? get().selected;
    set({ faction, selected: first });
  },
  setSeat: (seat) => set({ seat }),
  setPlacingSide: (placingSide) => set({ placingSide }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setSpeed: (speed) => set({ speed, paused: speed === 0 }),
  setPaused: (paused) => set({ paused }),
  setMessage: (message) => set({ message }),
  setFollowId: (followId) => set({ followId }),
  setHoverId: (hoverId) => set({ hoverId }),
  setBudget: (n) => set({ budget: clampBudget(n) }),
  addSpend: (side, cost) =>
    set((s) => {
      const spent: [number, number] = [...s.spent];
      spent[side] += cost;
      return { spent };
    }),
  resetSpend: () => set({ spent: [0, 0], placements: [], undo: [] }),
  pushPlace: (p) => set((s) => ({ placements: [...s.placements, p], undo: [] })),
  popPlace: () => {
    const list = get().placements;
    if (!list.length) return null;
    const last = list[list.length - 1];
    set({ placements: list.slice(0, -1), undo: [...get().undo, last] });
    return last;
  },
  redoPlace: () => {
    const stack = get().undo;
    if (!stack.length) return null;
    const next = stack[stack.length - 1];
    set({ undo: stack.slice(0, -1), placements: [...get().placements, next] });
    return next;
  },
  setYawOffset: (yawOffset) => set({ yawOffset }),
  pushKill: (line) =>
    set((s) => ({ killFeed: [line, ...s.killFeed].slice(0, 6) })),
  clearFeed: () => set({ killFeed: [], awarded: false }),
  setAwarded: (awarded) => set({ awarded }),
  setArena: (arena) => set({ arena }),
  startLadder: (ladderLevel, budget) =>
    set({
      vsAI: true,
      ladderLevel,
      budget,
      seat: "setupP1",
      placingSide: 0,
      spent: [0, 0],
      placements: [],
      undo: [],
      awarded: false,
      killFeed: [],
      message: `Ladder ${ladderLevel} — plant on the blue pad.`,
    }),
  togglePowerup: (side, id) =>
    set((s) => {
      const cur = s.powerups[side];
      const has = cur.includes(id);
      const next = has ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : cur;
      const powerups: [string[], string[]] = side === 0 ? [next, s.powerups[1]] : [s.powerups[0], next];
      let budget = s.budget;
      if (id === "pockets") budget = clampBudget(has ? s.budget / 1.15 : s.budget * 1.15);
      return { powerups, budget };
    }),
  setGhost: (ghost) => set({ ghost }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  bumpCam: (kind, value = 0) =>
    set((s) => ({ camBump: { id: (s.camBump?.id ?? 0) + 1, kind, value } })),
  resetMatch: () =>
    set({
      seat: "setupP1",
      placingSide: 0,
      spent: [0, 0],
      placements: [],
      undo: [],
      yawOffset: 0,
      killFeed: [],
      awarded: false,
      paused: false,
      speed: 1,
      message: "P1 — click the glowing blue pad.",
      followId: null,
      hoverId: null,
      vsAI: false,
      ladderLevel: null,
      powerups: [[], []],
    }),
}));
