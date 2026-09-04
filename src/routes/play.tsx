import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useProfiles } from "@/game/meta/profiles";
import { useGame } from "@/store/gameStore";

export const Route = createFileRoute("/play")({
  ssr: false,
  component: PlayProfiles,
});

const COLORS = ["#3a5f8a", "#b33a2b", "#c48a3a", "#2e5a2c", "#6b3a7a", "#2a6f6a"];

function PlayProfiles() {
  const nav = useNavigate();
  const profiles = useProfiles();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[2]);
  const [note, setNote] = useState("");

  useEffect(() => {
    profiles.ensureDefaults();
  }, [profiles]);

  const start = () => {
    if (!profiles.p1 || !profiles.p2) {
      setNote("Pick someone for both seats.");
      return;
    }
    if (profiles.p1 === profiles.p2) {
      setNote("P1 and P2 need different profiles.");
      return;
    }
    useGame.getState().resetMatch();
    nav({ to: "/battle" });
  };

  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-sm text-cream/70">Hot-seat</p>
        <h1 className="font-display text-5xl">Who's playing?</h1>
        <p className="mt-2 max-w-lg text-cream/80">
          Two local profiles on this computer. New ones start with 80 credits and 0 wins.
          Credits are the toy-money you earn after a fight.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {([0, 1] as const).map((seat) => {
            const current = seat === 0 ? profiles.p1 : profiles.p2;
            return (
              <section key={seat} className="toy-shadow rounded-card border-[3px] border-ink bg-cream p-4 text-ink">
                <h2 className="font-display text-2xl">{seat === 0 ? "Player 1" : "Player 2"}</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {profiles.profiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => profiles.setSeat(seat, p.id)}
                      className={`rounded-btn border-[3px] border-ink px-3 py-2 text-left ${
                        current === p.id ? "bg-ochre-hot" : "bg-parchment"
                      }`}
                    >
                      <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: p.color }} />
                      <span className="font-display">{p.name}</span>
                      <span className="ml-2 text-sm text-muted">
                        {p.credits} credits · {p.wins} wins
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="toy-shadow mt-6 rounded-card border-[3px] border-ink bg-cream p-4 text-ink">
          <h2 className="font-display text-xl">Manage profiles</h2>
          <p className="mb-3 text-sm text-muted">Keep at least two so both seats can be filled.</p>
          <ul className="flex flex-col gap-2">
            {profiles.profiles.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-btn border-[3px] border-ink bg-parchment px-3 py-2">
                <span>
                  <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <span className="font-display">{p.name}</span>
                  <span className="ml-2 text-sm text-muted">
                    {p.credits} credits · {p.wins} wins
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const ok = useProfiles.getState().remove(p.id);
                    setNote(ok ? `Removed ${p.name}.` : "Need two profiles to play hot-seat.");
                  }}
                  className="rounded-btn border-[3px] border-ink bg-cream px-3 py-1 text-sm font-display"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <form
          className="toy-shadow mt-6 flex flex-wrap items-end gap-2 rounded-card border-[3px] border-ink bg-cream p-4 text-ink"
          onSubmit={(e) => {
            e.preventDefault();
            profiles.create(name, color);
            setName("");
            setNote("");
          }}
        >
          <label className="flex flex-col text-sm">
            New profile
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display"
              placeholder="Name"
            />
          </label>
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-[3px] border-ink ${color === c ? "scale-110" : ""}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <button type="submit" className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display">
            Add
          </button>
        </form>

        {note && <p className="mt-3 text-sm text-cream/85">{note}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={start}
            className="toy-shadow rounded-btn border-[3px] border-ink bg-ochre-hot px-6 py-3 font-display text-2xl text-ink"
          >
            To the meadow
          </button>
          <Link to="/" className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-4 py-3 font-display text-ink">
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
