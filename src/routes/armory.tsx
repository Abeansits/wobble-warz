import { Link, createFileRoute } from "@tanstack/react-router";
import { FACTION_META } from "@/game/data/types";
import { M2_FACTIONS, rosterFor } from "@/game/data/units";

export const Route = createFileRoute("/armory")({
  ssr: false,
  component: ArmoryPage,
});

function ArmoryPage() {
  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-5xl">Armory</h1>
        <p className="mt-2 text-cream/80">Every toy in the box. Cosmetics come with the roll machine later.</p>
        {M2_FACTIONS.map((f) => (
          <section key={f} className="mt-8">
            <h2 className="font-display text-3xl" style={{ color: FACTION_META[f].color }}>
              {FACTION_META[f].name}
            </h2>
            <p className="text-sm text-cream/70">{FACTION_META[f].tag}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rosterFor(f).map((u) => (
                <article key={u.id} className="toy-shadow rounded-card border-[3px] border-ink bg-cream p-3 text-ink">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-xl">{u.name}</h3>
                    <span className="text-sm">{u.cost}</span>
                  </div>
                  <p className="text-sm text-muted">{u.blurb}</p>
                  <p className="mt-1 text-xs text-muted">
                    {u.body.hp} HP · {u.weapon.kind} · {u.weapon.damage} dmg
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
        <Link to="/" className="toy-shadow mt-8 inline-block rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink">
          Back
        </Link>
      </div>
    </main>
  );
}
