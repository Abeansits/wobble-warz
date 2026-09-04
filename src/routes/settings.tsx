import { Link, createFileRoute } from "@tanstack/react-router";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const Route = createFileRoute("/settings")({
  ssr: false,
  component: SettingsPage,
});

type Settings = {
  master: number;
  music: number;
  sfx: number;
  shake: boolean;
  blind: boolean;
  shadows: "high" | "low";
  /** Seconds ragdolls sit before fading. Sim still reads CORPSE_LIFE (6) until it wires this. */
  corpseLife: number;
  setMaster: (n: number) => void;
  setMusic: (n: number) => void;
  setSfx: (n: number) => void;
  setShake: (v: boolean) => void;
  setBlind: (v: boolean) => void;
  setShadows: (v: "high" | "low") => void;
  setCorpseLife: (n: number) => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      master: 0.7,
      music: 0.6,
      sfx: 0.8,
      shake: true,
      blind: true,
      shadows: "high",
      corpseLife: 6,
      setMaster: (master) => set({ master, music: master, sfx: master }),
      setMusic: (music) => set({ music }),
      setSfx: (sfx) => set({ sfx }),
      setShake: (shake) => set({ shake }),
      setBlind: (blind) => set({ blind }),
      setShadows: (shadows) => set({ shadows }),
      setCorpseLife: (corpseLife) => set({ corpseLife }),
    }),
    { name: "wobble-wars-settings" },
  ),
);

function SettingsPage() {
  const s = useSettings();
  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-5xl">Settings</h1>
        <label className="mt-6 block font-display">
          Master {Math.round((s.master ?? 0.7) * 100)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.master ?? 0.7}
            onChange={(e) => s.setMaster(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <p className="mt-1 text-sm text-cream/70">Sets music and clunks together. Tweak either below after.</p>
        <label className="mt-4 block font-display">
          Music {Math.round(s.music * 100)}
          <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => s.setMusic(Number(e.target.value))} className="mt-1 w-full" />
        </label>
        <label className="mt-4 block font-display">
          Clunks {Math.round(s.sfx * 100)}
          <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => s.setSfx(Number(e.target.value))} className="mt-1 w-full" />
        </label>
        <label className="mt-4 flex items-center gap-2 font-display">
          <input type="checkbox" checked={s.shake} onChange={(e) => s.setShake(e.target.checked)} />
          Camera shake
        </label>
        <label className="mt-2 flex items-center gap-2 font-display">
          <input type="checkbox" checked={s.blind} onChange={(e) => s.setBlind(e.target.checked)} />
          Blind placement on pass
        </label>
        <label className="mt-4 block font-display">
          Shadows
          <select
            className="ml-2 rounded-btn border-[3px] border-ink bg-cream px-2 py-1 text-ink"
            value={s.shadows}
            onChange={(e) => s.setShadows(e.target.value === "low" ? "low" : "high")}
          >
            <option value="high">High (2048)</option>
            <option value="low">Low (1024)</option>
          </select>
        </label>
        <label className="mt-4 block font-display">
          Corpse lifetime {s.corpseLife ?? 6}s
          <input
            type="number"
            min={1}
            max={30}
            step={1}
            value={s.corpseLife ?? 6}
            onChange={(e) => {
              const n = Number(e.target.value);
              s.setCorpseLife(Number.isFinite(n) ? Math.max(1, Math.min(30, Math.round(n))) : 6);
            }}
            className="ml-2 w-20 rounded-btn border-[3px] border-ink bg-cream px-2 py-1 text-ink"
          />
        </label>
        <p className="mt-1 text-sm text-cream/70">
          How long ragdolls sit before fading. Stored here; the fight still uses its built-in 6s until the sim reads this.
        </p>
        <p className="mt-4 text-sm text-cream/70">
          Music plays on the title and during fights. Shadows stay on; turn shake off if the camera wobbles too much.
        </p>
        <Link to="/" className="toy-shadow mt-6 inline-block rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink">
          Back
        </Link>
      </div>
    </main>
  );
}
