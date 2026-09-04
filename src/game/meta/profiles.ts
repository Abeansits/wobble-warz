import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Placement } from "@/game/data/types";

export type SavedArmy = {
  name: string;
  units: Placement[];
};

export type Profile = {
  id: string;
  name: string;
  color: string;
  credits: number;
  battles: number;
  wins: number;
  pity: number;
  rolls: number;
  anomalies: string[];
  cosmetics: string[];
  powerups: Record<string, number>;
  armies: SavedArmy[];
  hat: string | null;
  palette: string | null;
  ladderProgress: number;
  dailyBonusDate?: string;
  newAnomalies?: string[];
};

type ProfileStore = {
  profiles: Profile[];
  p1: string;
  p2: string;
  ensureDefaults: () => void;
  create: (name: string, color: string) => string;
  remove: (id: string) => boolean;
  setSeat: (seat: 0 | 1, id: string) => void;
  addCredits: (id: string, amount: number) => void;
  recordBattle: (id: string, won: boolean) => void;
  recordLadder: (id: string, level: number) => boolean;
  grantPrize: (id: string, prize: { kind: string; id?: string; name?: string; amount?: number }) => void;
  spendCredits: (id: string, amount: number) => boolean;
  usePowerups: (id: string, ids: string[]) => void;
  saveArmy: (id: string, name: string, units: Placement[]) => void;
  equip: (id: string, kind: "hat" | "palette", value: string | null) => void;
  byId: (id: string) => Profile | undefined;
  claimDailyBonus: (id: string) => number;
  clearNewAnomaly: (id: string, anomalyId: string) => void;
};

const COLORS = ["#3a5f8a", "#b33a2b", "#c48a3a", "#2e5a2c", "#6b3a7a", "#2a6f6a"];

function fresh(name: string, color: string): Profile {
  return {
    id: `p_${Math.random().toString(36).slice(2, 8)}`,
    name,
    color,
    credits: 80,
    battles: 0,
    wins: 0,
    pity: 0,
    rolls: 0,
    anomalies: [],
    cosmetics: [],
    powerups: {},
    armies: [],
    hat: null,
    palette: null,
    ladderProgress: 0,
    dailyBonusDate: "",
    newAnomalies: [],
  };
}

export const DAILY_BATTLE_BONUS = 50;

export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const useProfiles = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      p1: "",
      p2: "",
      ensureDefaults: () => {
        if (get().profiles.length >= 2 && get().p1 && get().p2) return;
        const a = fresh("Blue", COLORS[0]);
        const b = fresh("Red", COLORS[1]);
        set({ profiles: [a, b], p1: a.id, p2: b.id });
      },
      create: (name, color) => {
        const p = fresh(name.trim() || "Wobbler", color);
        set((s) => ({ profiles: [...s.profiles, p] }));
        return p.id;
      },
      remove: (id) => {
        const s = get();
        if (s.profiles.length <= 2) return false;
        const next = s.profiles.filter((p) => p.id !== id);
        if (next.length === s.profiles.length) return false;
        let p1 = s.p1 === id ? next[0].id : s.p1;
        let p2 = s.p2 === id ? next.find((p) => p.id !== p1)?.id ?? next[0].id : s.p2;
        if (p1 === p2) p2 = next.find((p) => p.id !== p1)?.id ?? p2;
        set({ profiles: next, p1, p2 });
        return true;
      },
      setSeat: (seat, id) => set(seat === 0 ? { p1: id } : { p2: id }),
      addCredits: (id, amount) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, credits: p.credits + amount } : p)),
        })),
      recordBattle: (id, won) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...p, battles: p.battles + 1, wins: p.wins + (won ? 1 : 0) } : p,
          ),
        })),
      recordLadder: (id, level) => {
        const p = get().profiles.find((x) => x.id === id);
        if (!p) return false;
        const prev = p.ladderProgress ?? 0;
        if (level <= prev) return false;
        set((s) => ({
          profiles: s.profiles.map((x) => (x.id === id ? { ...x, ladderProgress: level } : x)),
        }));
        return true;
      },
      spendCredits: (id, amount) => {
        const p = get().profiles.find((x) => x.id === id);
        if (!p || p.credits < amount) return false;
        set((s) => ({
          profiles: s.profiles.map((x) => (x.id === id ? { ...x, credits: x.credits - amount } : x)),
        }));
        return true;
      },
      grantPrize: (id, prize) =>
        set((s) => ({
          profiles: s.profiles.map((p) => {
            if (p.id !== id) return p;
            const next = {
              ...p,
              pity: prize.kind === "anomaly" ? 0 : (p.pity ?? 0) + 1,
              rolls: (p.rolls ?? 0) + 1,
              anomalies: [...(p.anomalies ?? [])],
              cosmetics: [...(p.cosmetics ?? [])],
              powerups: { ...(p.powerups ?? {}) },
              newAnomalies: [...(p.newAnomalies ?? [])],
            };
            if (prize.kind === "credits") next.credits += prize.amount ?? 0;
            if (prize.kind === "anomaly" && prize.id) {
              if (next.anomalies.includes(prize.id)) next.credits += 400;
              else {
                next.anomalies.push(prize.id);
                if (!next.newAnomalies.includes(prize.id)) next.newAnomalies.push(prize.id);
              }
            }
            if (prize.kind === "cosmetic" && prize.id) {
              if (next.cosmetics.includes(prize.id)) next.credits += 60;
              else next.cosmetics.push(prize.id);
            }
            if (prize.kind === "powerup" && prize.id) next.powerups[prize.id] = (next.powerups[prize.id] ?? 0) + 1;
            return next;
          }),
        })),
      usePowerups: (id, ids) =>
        set((s) => ({
          profiles: s.profiles.map((p) => {
            if (p.id !== id) return p;
            const powerups = { ...(p.powerups ?? {}) };
            for (const k of ids) {
              powerups[k] = Math.max(0, (powerups[k] ?? 0) - 1);
              if (powerups[k] === 0) delete powerups[k];
            }
            return { ...p, powerups };
          }),
        })),
      saveArmy: (id, name, units) =>
        set((s) => ({
          profiles: s.profiles.map((p) => {
            if (p.id !== id) return p;
            const armies = [...(p.armies ?? [])];
            const i = armies.findIndex((a) => a.name === name);
            const next = { name, units };
            if (i >= 0) armies[i] = next;
            else armies.push(next);
            return { ...p, armies };
          }),
        })),
      equip: (id, kind, value) =>
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === id ? { ...p, [kind]: value } : p)),
        })),
      byId: (id) => get().profiles.find((p) => p.id === id),
      claimDailyBonus: (id) => {
        const p = get().profiles.find((x) => x.id === id);
        if (!p) return 0;
        const today = localDateKey();
        if (p.dailyBonusDate === today) return 0;
        set((s) => ({
          profiles: s.profiles.map((x) => (x.id === id ? { ...x, dailyBonusDate: today } : x)),
        }));
        return DAILY_BATTLE_BONUS;
      },
      clearNewAnomaly: (id, anomalyId) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id
              ? { ...p, newAnomalies: (p.newAnomalies ?? []).filter((x) => x !== anomalyId) }
              : p,
          ),
        })),
    }),
    {
      name: "wobble-wars-profiles",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
          : localStorage,
      ),
    },
  ),
);

export function ladderPayout(level: number, first: boolean) {
  const n = 60 + level * 12;
  return first ? n : Math.round(n / 2);
}

export function creditPayout(winner: 0 | 1 | "draw", enemyCost: number, mvpSide: 0 | 1) {
  const win = 120 + Math.round(enemyCost * 0.05);
  const loss = 40;
  const p1 = winner === "draw" ? 60 : winner === 0 ? win : loss;
  const p2 = winner === "draw" ? 60 : winner === 1 ? win : loss;
  return {
    p1: p1 + (mvpSide === 0 ? 20 : 0),
    p2: p2 + (mvpSide === 1 ? 20 : 0),
  };
}
