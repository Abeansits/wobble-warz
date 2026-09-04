import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ROLL_BUNDLE_COST,
  ROLL_BUNDLE_COUNT,
  ROLL_COST,
  prizeLabel,
  rollMany,
  rollPrize,
  type Prize,
} from "@/game/data/rolls";
import { getUnit } from "@/game/data/units";
import { useProfiles } from "@/game/meta/profiles";
import { PlinkoBoard } from "@/game/render/PlinkoBoard";
import { UnitPreview } from "@/game/render/UnitPreview";
import { ToyButton } from "@/ui/ToyButton";

export const Route = createFileRoute("/roll")({
  ssr: false,
  component: RollPage,
});

function LeverStrip({ onPull, disabled }: { onPull: () => void; disabled: boolean }) {
  const start = useRef<number | null>(null);
  const [y, setY] = useState(0);
  const fired = useRef(false);
  const reset = () => {
    start.current = null;
    fired.current = false;
    setY(0);
  };
  return (
    <div
      className={`absolute right-3 top-12 flex h-52 w-14 flex-col items-center rounded-btn border-[3px] border-ink bg-parchment ${
        disabled ? "opacity-60" : ""
      }`}
      onPointerDown={(e) => {
        if (disabled) return;
        start.current = e.clientY;
        fired.current = false;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current == null || disabled) return;
        const d = Math.max(0, Math.min(140, e.clientY - start.current));
        setY(d);
        if (d > 90 && !fired.current) {
          fired.current = true;
          onPull();
        }
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <span className="mt-1 font-display text-[10px] tracking-wide text-ink">PULL</span>
      <span
        className="mt-2 h-9 w-9 rounded-full border-[3px] border-ink bg-crimson"
        style={{ transform: `translateY(${y}px)` }}
      />
    </div>
  );
}

function RollPage() {
  const profiles = useProfiles();
  const [who, setWho] = useState(profiles.p1 || profiles.profiles[0]?.id || "");
  const [dropping, setDropping] = useState(false);
  const [open, setOpen] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);
  const [haul, setHaul] = useState<Prize[] | null>(null);
  const [note, setNote] = useState("");
  const [dropNonce, setDropNonce] = useState(0);
  const [cine, setCine] = useState(false);

  useEffect(() => {
    profiles.ensureDefaults();
    const s = useProfiles.getState();
    if (!who && s.p1) setWho(s.p1);
  }, [profiles, who]);

  useEffect(() => {
    if (!open || prize?.kind !== "anomaly") {
      setCine(false);
      return;
    }
    setCine(true);
    const t = window.setTimeout(() => setCine(false), 2000);
    return () => window.clearTimeout(t);
  }, [open, prize]);

  const me = profiles.profiles.find((p) => p.id === who) ?? profiles.profiles[0];

  const beginDrop = (next: Prize, extras: Prize[] | null) => {
    setPrize(next);
    setHaul(extras);
    setOpen(false);
    setDropping(true);
    setNote("");
    setDropNonce((n) => n + 1);
  };

  const pull = () => {
    if (!me || dropping) return;
    const api = useProfiles.getState();
    const current = api.byId(me.id);
    if (!current) return;
    if (current.credits < ROLL_COST) {
      setNote(`Need ${ROLL_COST} credits. Win a fight first.`);
      return;
    }
    if (!api.spendCredits(me.id, ROLL_COST)) return;
    const next = rollPrize(current.pity ?? 0);
    api.grantPrize(me.id, next);
    beginDrop(next, null);
  };

  const pullTen = () => {
    if (!me || dropping) return;
    const api = useProfiles.getState();
    const current = api.byId(me.id);
    if (!current) return;
    if (current.credits < ROLL_BUNDLE_COST) {
      setNote(`Need ${ROLL_BUNDLE_COST} credits for a 10-pull.`);
      return;
    }
    if (!api.spendCredits(me.id, ROLL_BUNDLE_COST)) return;
    const prizes = rollMany(ROLL_BUNDLE_COUNT, current.pity ?? 0);
    for (const next of prizes) api.grantPrize(me.id, next);
    const star = prizes.find((p) => p.kind === "anomaly") ?? prizes[prizes.length - 1] ?? null;
    if (star) beginDrop(star, prizes);
  };

  const anomalyDef = (() => {
    if (prize?.kind !== "anomaly") return null;
    try {
      return getUnit(prize.id);
    } catch {
      return null;
    }
  })();

  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-2xl">
        <p className="font-display text-sm text-cream/70">Gumball</p>
        <h1 className="font-display text-5xl">Roll</h1>
        <p className="mt-2 text-cream/80">
          {ROLL_COST} credits a pull, or {ROLL_BUNDLE_COST} for ten. Pity hands you an Anomaly on the 20th dry roll.
          Rarity color leaks through the capsule — watch the bounce.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {profiles.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setWho(p.id)}
              className={`min-h-11 rounded-btn border-[3px] border-ink px-3 py-2 font-display text-ink toy-press ${
                who === p.id ? "bg-ochre-hot" : "bg-cream"
              }`}
            >
              {p.name} · {p.credits}
            </button>
          ))}
        </div>

        <div className="relative mt-8">
          <PlinkoBoard prize={prize} dropNonce={dropNonce} onSettled={() => { setOpen(true); setDropping(false); }} />
          <LeverStrip onPull={pull} disabled={dropping || !me} />
          {open && prize?.kind === "anomaly" && (
            <img src="/assets/badge-new.png" alt="" className="pointer-events-none absolute left-4 top-4 h-16 w-16" />
          )}
        </div>

        <p className="mt-4 font-display text-2xl">
          {dropping ? "It's bouncing…" : open && prize ? prizeLabel(prize) : "Drag the lever. Or smash the button."}
        </p>
        {note && <p className="mt-1 text-sm text-cream/80">{note}</p>}
        {me && (
          <p className="mt-1 text-sm text-cream/70">
            Pity {me.pity ?? 0}/20 · {me.anomalies?.length ?? 0} anomalies
          </p>
        )}

        {haul && open && (
          <ul className="mt-3 grid grid-cols-2 gap-1 text-sm text-cream/90">
            {haul.map((p, i) => (
              <li key={`${p.kind}-${i}`} className={p.kind === "anomaly" ? "font-display text-ochre-hot" : ""}>
                {p.kind === "credits" ? `+${p.amount} credits` : p.name}
              </li>
            ))}
          </ul>
        )}

        <ToyButton variant="primary" size="lg" className="mt-6" onClick={pull} disabled={dropping}>
          Pull lever
        </ToyButton>
        <ToyButton variant="ghost" size="lg" className="ml-3 mt-6" onClick={pullTen} disabled={dropping}>
          10-pull · {ROLL_BUNDLE_COST}
        </ToyButton>
        <ToyButton variant="secondary" className="ml-3 mt-6" asChild>
          <Link to="/">Back</Link>
        </ToyButton>
      </div>

      {cine && prize?.kind === "anomaly" && anomalyDef && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/70 px-4">
          <div className="toy-shadow w-full max-w-md rounded-card border-[3px] border-ink bg-cream p-4 text-ink">
            <p className="font-display text-sm text-ochre-hot">Anomaly</p>
            <h2 className="font-display text-4xl">{prize.name}</h2>
            <p className="mb-3 text-muted">{anomalyDef.blurb}</p>
            <UnitPreview def={anomalyDef} cosmetic={me?.palette ?? null} hat={me?.hat ?? null} />
          </div>
        </div>
      )}
    </main>
  );
}
