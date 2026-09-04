import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { TitleToys } from "@/game/render/TitleToys";
import { startHotseat } from "@/game/meta/hotseat";
import { ToyButton } from "@/ui/ToyButton";

export const Route = createFileRoute("/")({ component: Home });

const PLAY = [
  { to: "/ladder" as const, label: "Play solo", blurb: "Twenty preset armies. You plant, they march.", variant: "primary" as const },
  { to: "/battle" as const, label: "Play together", blurb: "Hot-seat. Two players, one meadow.", variant: "secondary" as const, hotseat: true },
];

const MORE = [
  { to: "/armory" as const, label: "Armory" },
  { to: "/roll" as const, label: "Roll" },
  { to: "/settings" as const, label: "Settings" },
];

function Home() {
  const nav = useNavigate();
  return (
    <main className="relative min-h-dvh overflow-hidden bg-meadow-deep text-cream">
      <TitleToys />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col justify-between px-5 py-8 md:px-8 md:py-10">
        <header className="flex items-start justify-between gap-4">
          <p className="toy-press rounded-btn border-[3px] border-ink bg-cream px-3 py-1 font-display text-sm text-ink">
            Playable
          </p>
          <p className="max-w-xs text-right text-sm text-cream/85 drop-shadow-[2px_2px_0_#1c1710]">
            Two sides of wobbly toy soldiers. Physics decides who wins.
          </p>
        </header>
        <div className="max-w-xl">
          <img
            src="/assets/logo.png"
            alt=""
            className="mb-3 max-h-24 w-auto rounded-card border-[3px] border-ink outline outline-1 -outline-offset-1 outline-ink/20 toy-shadow md:max-h-32"
          />
          <h1 className="font-display text-6xl leading-none tracking-tight text-cream drop-shadow-[6px_6px_0_#1c1710] md:text-8xl">
            Wobble Wars
          </h1>
          <p className="mt-4 max-w-lg text-lg text-cream/90 drop-shadow-[2px_2px_0_#1c1710]">
            Five factions. Three arenas. Plant an army, pass the keyboard, watch them flop.
          </p>
          <nav className="mt-8 flex flex-col gap-4" aria-label="Play">
            <div className="flex flex-col gap-3 sm:flex-row">
              {PLAY.map((l) => (
                <ToyButton key={l.label} variant={l.variant} size="lg" asChild className="h-auto min-h-14 sm:flex-1 sm:items-stretch">
                  <Link
                    to={l.to}
                    onClick={(e) => {
                      if (!("hotseat" in l) || !l.hotseat) return;
                      if (!startHotseat().ok) {
                        e.preventDefault();
                        void nav({ to: "/play" });
                      }
                    }}
                  >
                    <span className="flex flex-col items-start gap-0.5 text-left">
                      <span>{l.label}</span>
                      <span className="font-sans text-sm font-bold text-ink/70">{l.blurb}</span>
                    </span>
                  </Link>
                </ToyButton>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1">
              {MORE.map((l) => (
                <ToyButton key={l.label} variant="quiet" size="sm" asChild className="px-0">
                  <Link to={l.to}>{l.label}</Link>
                </ToyButton>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </main>
  );
}
