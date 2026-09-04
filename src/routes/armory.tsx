import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { COSMETICS } from "@/game/data/rolls";
import { FACTION_META } from "@/game/data/types";
import { M2_FACTIONS, rosterFor } from "@/game/data/units";
import { useProfiles } from "@/game/meta/profiles";
import { UnitPreview } from "@/game/render/UnitPreview";
import type { UnitDef } from "@/game/data/types";

export const Route = createFileRoute("/armory")({
  ssr: false,
  component: ArmoryPage,
});

function ArmoryPage() {
  const profiles = useProfiles();
  useEffect(() => {
    profiles.ensureDefaults();
  }, [profiles]);
  const me = profiles.profiles.find((p) => p.id === profiles.p1);
  const [picked, setPicked] = useState<UnitDef | null>(null);
  const shown = picked ?? rosterFor("stoneage")[0];

  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-5xl">Armory</h1>
        <p className="mt-2 text-cream/80">Every toy in the box. Equip a hat or palette you rolled.</p>

        {shown && (
          <section className="toy-shadow mt-6 rounded-card border-[3px] border-ink bg-cream p-4 text-ink">
            <h2 className="font-display text-2xl">{shown.name}</h2>
            <p className="mb-3 text-sm text-muted">{shown.blurb}</p>
            <UnitPreview def={shown} cosmetic={me?.palette ?? null} />
          </section>
        )}

        {me && (
          <section className="toy-shadow mt-6 rounded-card border-[3px] border-ink bg-cream p-4 text-ink">
            <h2 className="font-display text-2xl">Equipped — {me.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {COSMETICS.map((c) => {
                const owned = me.cosmetics?.includes(c.id);
                const on = me.hat === c.id || me.palette === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!owned}
                    onClick={() => profiles.equip(me.id, c.id.startsWith("hat") ? "hat" : "palette", on ? null : c.id)}
                    className={`rounded-btn border-[3px] border-ink px-3 py-2 font-display ${
                      on ? "bg-ochre-hot" : owned ? "bg-parchment" : "bg-parchment/40 text-muted"
                    }`}
                  >
                    {c.name}
                    {!owned ? " (locked)" : ""}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {M2_FACTIONS.map((f) => (
          <section key={f} className="mt-8">
            <h2 className="font-display text-3xl" style={{ color: FACTION_META[f].color }}>
              {FACTION_META[f].name}
            </h2>
            <p className="text-sm text-cream/70">{FACTION_META[f].tag}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rosterFor(f).map((u) => (
                <article
                  key={u.id}
                  className="toy-shadow cursor-pointer rounded-card border-[3px] border-ink bg-cream p-3 text-ink"
                  onClick={() => setPicked(u)}
                >
                  <div className="mb-1 flex h-8 overflow-hidden rounded-btn border-[2px] border-ink">
                    <span className="w-1/2" style={{ background: u.palette.primary }} />
                    <span className="w-1/4" style={{ background: u.palette.skin }} />
                    <span className="w-1/4" style={{ background: u.palette.accent }} />
                  </div>
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
