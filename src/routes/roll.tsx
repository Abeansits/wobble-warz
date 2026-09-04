import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ROLL_COST, rollPrize, type Prize } from "@/game/data/rolls";
import { useProfiles } from "@/game/meta/profiles";

export const Route = createFileRoute("/roll")({
  ssr: false,
  component: RollPage,
});

function RollPage() {
  const profiles = useProfiles();
  const [who, setWho] = useState(profiles.p1 || profiles.profiles[0]?.id || "");
  const [dropping, setDropping] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);
  const [note, setNote] = useState("");
  const me = profiles.profiles.find((p) => p.id === who);

  const pull = () => {
    if (!me || dropping) return;
    if (me.credits < ROLL_COST) {
      setNote(`Need ${ROLL_COST} credits. Win a fight first.`);
      return;
    }
    if (!profiles.spendCredits(me.id, ROLL_COST)) return;
    const next = rollPrize(me.pity ?? 0);
    setDropping(true);
    setPrize(null);
    setNote("");
    window.setTimeout(() => {
      useProfiles.getState().grantPrize(me.id, next);
      setPrize(next);
      setDropping(false);
    }, 1400);
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
          {ROLL_COST} credits a pull. Pity hands you an Anomaly on the 20th dry roll.
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

        <div className="toy-shadow relative mt-8 h-72 overflow-hidden rounded-card border-[3px] border-ink bg-[#3a2a1c]">
          <div className="absolute inset-x-6 top-4 grid grid-cols-5 gap-6 opacity-70">
            {Array.from({ length: 15 }).map((_, i) => (
              <span key={i} className="h-3 w-3 rounded-full bg-ochre" />
            ))}
          </div>
          <div
            className={`absolute left-1/2 h-10 w-10 -translate-x-1/2 rounded-full border-[3px] border-ink ${
              dropping ? "animate-bounce bg-ochre-hot" : "top-8 bg-cream"
            }`}
            style={dropping ? { top: "70%" } : undefined}
          />
          <div className="absolute inset-x-10 bottom-4 h-8 rounded-btn border-[3px] border-ink bg-parchment" />
        </div>

        <p className="mt-4 font-display text-2xl">
          {dropping ? "It's bouncing…" : label || "Pull the lever."}
        </p>
        {note && <p className="mt-1 text-sm text-cream/80">{note}</p>}
        {me && (
          <p className="mt-1 text-sm text-cream/70">
            Pity {me.pity ?? 0}/20 · rolls {me.rolls ?? 0}
          </p>
        )}

        <button
          type="button"
          onClick={pull}
          disabled={dropping}
          className="toy-shadow mt-6 rounded-btn border-[3px] border-ink bg-ochre-hot px-6 py-3 font-display text-2xl text-ink disabled:opacity-60"
        >
          Pull ({ROLL_COST})
        </button>
        <div className="mt-4 flex gap-3">
          <Link to="/" className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink">
            Title
          </Link>
          <Link to="/play" className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink">
            Play
          </Link>
        </div>
      </div>
    </main>
  );
}
