import { Link, createFileRoute } from "@tanstack/react-router";
import { TitleToys } from "@/game/render/TitleToys";

export const Route = createFileRoute("/")({ component: Home });

const LINKS = [
  { to: "/play" as const, label: "Play", blurb: "Hot-seat. Two profiles, one meadow." },
  { to: "/ladder" as const, label: "Ladder", blurb: "Twenty preset armies. You plant, they march." },
  { to: "/armory" as const, label: "Armory", blurb: "All 30 toys, stats and gimmicks." },
  { to: "/roll" as const, label: "Roll", blurb: "Spend 200 credits. Pity after 20 dry pulls." },
  { to: "/settings" as const, label: "Settings", blurb: "Volume, shake, blind placement." },
];

function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-meadow-deep text-cream">
      <TitleToys />
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col justify-between px-6 py-10">
        <header className="flex items-start justify-between gap-4">
          <p className="rounded-btn border-[3px] border-ink bg-cream px-3 py-1 font-display text-ink toy-shadow">
            Milestone 2
          </p>
          <p className="max-w-xs text-right text-sm text-cream/80 drop-shadow-[2px_2px_0_#1c1710]">
            Two sides of wobbly toy soldiers. Physics decides who wins.
          </p>
        </header>
        <div>
          <img
            src="/logo.jpg"
            alt="Wobble Wars"
            className="mb-4 max-h-28 w-auto rounded-card border-[3px] border-ink toy-shadow md:max-h-36"
          />
          <h1 className="font-display text-6xl leading-none tracking-tight text-cream drop-shadow-[6px_6px_0_#1c1710] md:text-8xl">
            Wobble Wars
          </h1>
          <p className="mt-4 max-w-xl text-lg text-cream/90 drop-shadow-[2px_2px_0_#1c1710]">
            Five factions. Three arenas. Plant an army, pass the keyboard, watch them flop.
          </p>
        </div>
        <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="toy-shadow rounded-card border-[3px] border-ink bg-cream p-4 text-ink transition-transform hover:scale-[1.02] active:scale-95"
            >
              <span className="font-display text-2xl">{l.label}</span>
              <p className="mt-1 text-sm text-muted">{l.blurb}</p>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
