import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LADDER } from "@/game/data/ladder";
import { useGame } from "@/store/gameStore";
import { useProfiles } from "@/game/meta/profiles";

export const Route = createFileRoute("/ladder")({
  ssr: false,
  component: LadderPage,
});

function LadderPage() {
  const nav = useNavigate();
  const profiles = useProfiles();
  const progress = useProfiles((s) => s.profiles.find((p) => p.id === s.p1)?.ladderProgress ?? 0);

  useEffect(() => {
    profiles.ensureDefaults();
  }, [profiles]);

  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-4xl">
        <p className="font-display text-sm text-cream/70">Play solo</p>
        <h1 className="font-display text-5xl">Ladder</h1>
        <p className="mt-2 max-w-lg text-cream/80">
          Twenty preset armies. You plant yours, they march in from the red pad.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {LADDER.map((lvl) => {
            const locked = lvl.id > 1 && lvl.id > progress + 1;
            return (
              <button
                key={lvl.id}
                type="button"
                disabled={locked}
                onClick={() => {
                  useGame.getState().resetMatch();
                  useGame.getState().startLadder(lvl.id, lvl.budget);
                  nav({ to: "/battle" });
                }}
                className={`toy-shadow rounded-card border-[3px] border-ink p-4 text-left text-ink ${
                  locked ? "bg-parchment/60" : "bg-cream hover:scale-[1.01]"
                }`}
              >
                <p className="font-display text-xl">
                  {lvl.id}. {lvl.name}
                </p>
                <p className="text-sm text-muted">{locked ? "Win the one before this." : lvl.blurb}</p>
                <p className="mt-1 text-sm">{lvl.budget} budget</p>
              </button>
            );
          })}
        </div>
        <Link to="/" className="toy-shadow mt-6 inline-block rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink">
          Back
        </Link>
      </div>
    </main>
  );
}
