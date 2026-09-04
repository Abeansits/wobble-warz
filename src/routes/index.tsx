import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

const LINKS = [
  { to: "/play" as const, label: "Play", blurb: "Hot-seat. Pick profiles, plant armies, hit GO." },
  { to: "/ladder" as const, label: "Ladder", blurb: "Vs AI — coming after the physics spike." },
  { to: "/armory" as const, label: "Armory", blurb: "Turntable + cosmetics — later." },
  { to: "/roll" as const, label: "Roll", blurb: "Gumball machine gacha — later." },
  { to: "/settings" as const, label: "Settings", blurb: "Volume, shake, corpses." },
];

function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-meadow-deep text-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#8ec6e8_0%,transparent_45%),radial-gradient(circle_at_80%_80%,#c48a3a55_0%,transparent_40%)]" />
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col justify-between px-6 py-10">
        <header className="flex items-start justify-between gap-4">
          <p className="rounded-btn border-[3px] border-ink bg-cream px-3 py-1 font-display text-ink toy-shadow">
            Milestone 1
          </p>
          <p className="max-w-xs text-right text-sm text-cream/80">
            Two sides of wobbly toy soldiers. Physics decides who wins.
          </p>
        </header>
        <div>
          <h1 className="font-display text-6xl leading-none tracking-tight text-cream drop-shadow-[6px_6px_0_#1c1710] md:text-8xl">
            Wobble Wars
          </h1>
          <p className="mt-4 max-w-xl text-lg text-cream/90">
            Plant Stone Age and Medieval toys on Highland Meadow. Pass the keyboard. Physics decides.
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
