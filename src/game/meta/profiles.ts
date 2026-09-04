import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Profile = {
  id: string;
  name: string;
  color: string;
  credits: number;
  battles: number;
  wins: number;
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
  byId: (id: string) => Profile | undefined;
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
  };
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
      byId: (id) => get().profiles.find((p) => p.id === id),
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
