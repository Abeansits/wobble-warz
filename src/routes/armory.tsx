import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { COSMETICS } from "@/game/data/rolls";
import { FACTION_META, type UnitDef } from "@/game/data/types";
import { M2_FACTIONS, rosterFor } from "@/game/data/units";
import { useProfiles, type Profile } from "@/game/meta/profiles";
import { UnitPreview } from "@/game/render/UnitPreview";

export const Route = createFileRoute("/armory")({
  ssr: false,
  component: ArmoryPage,
});

const WEAPON_LABEL: Record<string, string> = {
  melee: "Melee",
  "melee-reach": "Reach",
  projectile: "Lob",
  explosive: "Boom",
  charge: "Charge",
  aura: "Aura",
  hitscan: "Hitscan",
  tether: "Grab",
  status: "Status",
  summon: "Summon",
};

function anomalyUnlocked(profile: Profile | undefined, id: string): boolean {
  if (!profile) return false;
  if (profile.anomalies?.includes(id)) return true;
  const extra = (profile as Profile & { unlockedAnomalies?: string[] }).unlockedAnomalies;
  return Array.isArray(extra) && extra.includes(id);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-btn border-[2px] border-ink bg-parchment px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-lg leading-none">{value}</p>
    </div>
  );
}

function UnitCard({
  u,
  selected,
  locked,
  onPick,
}: {
  u: UnitDef;
  selected: boolean;
  locked?: boolean;
  onPick: (u: UnitDef) => void;
}) {
  return (
    <article
      className={`toy-shadow cursor-pointer rounded-card border-[3px] border-ink p-3 text-ink ${
        selected ? "bg-ochre-hot" : locked ? "bg-parchment/70" : "bg-cream"
      }`}
      onClick={() => onPick(u)}
    >
      <div className="mb-1 flex h-8 overflow-hidden rounded-btn border-[2px] border-ink">
        <span className="w-1/2" style={{ background: u.palette.primary }} />
        <span className="w-1/4" style={{ background: u.palette.skin }} />
        <span className="w-1/4" style={{ background: u.palette.accent }} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xl">{u.name}</h3>
        <span className="text-sm">{locked ? "Locked" : u.cost}</span>
      </div>
      <p className="text-sm text-muted">{u.blurb}</p>
      <p className="mt-1 text-xs text-muted">
        {u.body.hp} HP · {WEAPON_LABEL[u.weapon.kind] ?? u.weapon.kind} · {u.weapon.damage} dmg
      </p>
    </article>
  );
}

function ArmoryPage() {
  const profiles = useProfiles();
  useEffect(() => {
    profiles.ensureDefaults();
  }, [profiles]);
  const me = profiles.profiles.find((p) => p.id === profiles.p1);
  const [picked, setPicked] = useState<UnitDef | null>(null);
  const shown = picked ?? rosterFor("stoneage")[0];
  const anomalies = rosterFor("anomaly");
  const shownLocked = shown?.faction === "anomaly" && !anomalyUnlocked(me, shown.id);

  return (
    <main className="min-h-dvh bg-meadow-deep px-6 py-10 text-cream">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-5xl">Armory</h1>
        <p className="mt-2 text-cream/80">Every toy in the box. Equip a hat or palette you rolled.</p>

        {shown && (
          <section className="toy-shadow mt-6 rounded-card border-[3px] border-ink bg-cream p-4 text-ink">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <UnitPreview def={shown} cosmetic={me?.palette ?? null} hat={me?.hat ?? null} />
              <div>
                <p className="text-sm font-display" style={{ color: FACTION_META[shown.faction].color }}>
                  {FACTION_META[shown.faction].name}
                  {shownLocked ? " · Locked" : ""}
                </p>
                <h2 className="font-display text-3xl leading-none">{shown.name}</h2>
                <p className="mt-2 text-sm text-muted">{shown.blurb}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat label="Cost" value={shown.cost} />
                  <Stat label="HP" value={shown.body.hp} />
                  <Stat label="Speed" value={shown.body.speed.toFixed(1)} />
                  <Stat label="Weapon" value={WEAPON_LABEL[shown.weapon.kind] ?? shown.weapon.kind} />
                  <Stat label="Damage" value={shown.weapon.damage} />
                  <Stat label="Range" value={shown.weapon.range.toFixed(1)} />
                </div>
                <p className="mt-3 rounded-btn border-[2px] border-ink bg-parchment px-3 py-2 text-sm">
                  <span className="font-display">Gimmick. </span>
                  {shown.blurb}
                  {shown.abilities?.length
                    ? ` · ${shown.abilities.map((a) => a.kind.replace("-", " ")).join(", ")}`
                    : ""}
                </p>
              </div>
            </div>
          </section>
        )}

        {me && (
          <section className="toy-shadow mt-6 rounded-card border-[3px] border-ink bg-cream p-4 text-ink">
            <h2 className="font-display text-2xl">Equipped — {me.name}</h2>
            <p className="text-sm text-muted">Hats and palettes show on the turntable.</p>
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
                <UnitCard key={u.id} u={u} selected={shown?.id === u.id} onPick={setPicked} />
              ))}
            </div>
          </section>
        ))}

        <section className="mt-8">
          <h2 className="font-display text-3xl" style={{ color: FACTION_META.anomaly.color }}>
            {FACTION_META.anomaly.name}
          </h2>
          <p className="text-sm text-cream/70">
            {FACTION_META.anomaly.tag}. Locked until you roll them.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {anomalies.map((u) => (
              <UnitCard
                key={u.id}
                u={u}
                selected={shown?.id === u.id}
                locked={!anomalyUnlocked(me, u.id)}
                onPick={setPicked}
              />
            ))}
          </div>
        </section>

        <Link to="/" className="toy-shadow mt-8 inline-block rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink">
          Back
        </Link>
      </div>
    </main>
  );
}
