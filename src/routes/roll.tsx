import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ROLL_BUNDLE_COST, ROLL_BUNDLE_COUNT, ROLL_COST, rollMany, rollPrize, type Prize } from "@/game/data/rolls";
import { useProfiles } from "@/game/meta/profiles";

export const Route = createFileRoute("/roll")({
  ssr: false,
  component: RollPage,
});

const RARITY: Record<Prize["kind"], string> = {
  powerup: "#c48a3a",
  cosmetic: "#3a5f8a",
  credits: "#efe0b4",
  anomaly: "#d4a017",
};

function RollPage() {
  const profiles = useProfiles();
  const [who, setWho] = useState(profiles.p1 || profiles.profiles[0]?.id || "");
  const [dropping, setDropping] = useState(false);
  const [open, setOpen] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);
  const [haul, setHaul] = useState<Prize[] | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    profiles.ensureDefaults();
    const s = useProfiles.getState();
    if (!who && s.p1) setWho(s.p1);
  }, [profiles, who]);

  const me = profiles.profiles.find((p) => p.id === who) ?? profiles.profiles[0];
  const color = prize ? RARITY[prize.kind] : "#e09a2c";

  const pull = () => {
    if (!me || dropping) return;
    if (me.credits < ROLL_COST) {
      setNote(`Need ${ROLL_COST} credits. Win a fight first.`);
      return;
    }
    if (!profiles.spendCredits(me.id, ROLL_COST)) return;
    const next = rollPrize(me.pity ?? 0);
    setDropping(true);
    setOpen(false);
    setHaul(null);
    setPrize(next);
    setNote("");
    window.setTimeout(() => {
      setOpen(true);
      useProfiles.getState().grantPrize(me.id, next);
      setDropping(false);
    }, 1300);
  };

  const pullTen = () => {
    if (!me || dropping) return;
    if (me.credits < ROLL_BUNDLE_COST) {
      setNote(`Need ${ROLL_BUNDLE_COST} credits for a 10-pull.`);
      return;
    }
    if (!profiles.spendCredits(me.id, ROLL_BUNDLE_COST)) return;
    const api = useProfiles.getState();
    const prizes = rollMany(ROLL_BUNDLE_COUNT, api.byId(me.id)?.pity ?? 0);
    for (const next of prizes) api.grantPrize(me.id, next);
    const star = prizes.find((p) => p.kind === "anomaly") ?? prizes[prizes.length - 1] ?? null;
    setHaul(prizes);
    setPrize(star);
    setOpen(true);
    setDropping(false);
    setNote("");
  };

  const label = useMemo(() => {
    if (!prize) return "";
    if (prize.kind === "credits") return `+${prize.amount} credits bounced back`;
    if (prize.kind === "anomaly") return `ANOMALY — ${prize.name}`;
    return prize.name;
  }, [prize]);

  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-xl">
        <p className="font-display text-sm text-cream/70">Gumball</p>
        <h1 className="font-display text-5xl">Roll</h1>
        <p className="mt-2 text-cream/80">
          {ROLL_COST} credits a pull, or {ROLL_BUNDLE_COST} for ten. Pity hands you an Anomaly on the 20th dry roll.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {profiles.profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setWho(p.id)}
              className={`toy-shadow rounded-btn border-[3px] border-ink px-3 py-2 font-display text-ink ${
                who === p.id ? "bg-ochre-hot" : "bg-cream"
              }`}
            >
              {p.name} · {p.credits}
            </button>
          ))}
        </div>

        <div className="toy-shadow relative mt-8 h-80 overflow-hidden rounded-card border-[3px] border-ink bg-[#3a2a1c]">
          <div className="absolute inset-x-8 top-6 grid grid-cols-5 gap-y-8">
            {Array.from({ length: 20 }).map((_, i) => (
              <span key={i} className="mx-auto h-3 w-3 rounded-full bg-ochre" />
            ))}
          </div>
          <div
            className="absolute h-12 w-12 rounded-full border-[3px] border-ink"
            style={{
              background: color,
              left: dropping ? "58%" : open ? "46%" : "46%",
              top: dropping ? "68%" : open ? "70%" : "8%",
              transform: open ? "scale(1.15)" : "scale(1)",
              boxShadow: prize?.kind === "anomaly" && open ? "0 0 24px #d4a017" : "4px 4px 0 #1c1710",
              transition: dropping
                ? "left 1.2s ease-in-out, top 1.2s cubic-bezier(.2,1.4,.4,1)"
                : "transform 180ms ease",
            }}
          />
          <div className="absolute inset-x-8 bottom-3 h-10 rounded-btn border-[3px] border-ink bg-parchment" />
          {open && prize?.kind === "anomaly" && (
            <img src="/assets/badge-new.png" alt="" className="pointer-events-none absolute right-4 top-4 h-16 w-16" />
          )}
        </div>

        <p className="mt-4 font-display text-2xl">
          {dropping ? "It's bouncing…" : open ? label : "Pull the lever."}
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

        <button
          type="button"
          onClick={pull}
          disabled={dropping}
          className="toy-shadow mt-6 rounded-btn border-[3px] border-ink bg-ochre-hot px-6 py-3 font-display text-2xl text-ink active:scale-95 disabled:opacity-60"
        >
          Pull lever
        </button>
        <button
          type="button"
          onClick={pullTen}
          disabled={dropping}
          className="toy-shadow ml-3 mt-6 rounded-btn border-[3px] border-ink bg-parchment px-4 py-3 font-display text-xl text-ink active:scale-95 disabled:opacity-60"
        >
          10-pull · {ROLL_BUNDLE_COST}
        </button>
        <Link to="/" className="toy-shadow ml-3 inline-block rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink">
          Back
        </Link>
      </div>
    </main>
  );
}
