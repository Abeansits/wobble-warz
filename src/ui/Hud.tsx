import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FACTION_META, type FactionId } from "@/game/data/types";
import { ARENAS } from "@/game/data/arenas";
import { POWERUPS } from "@/game/data/rolls";
import { LADDER, ladderArmy } from "@/game/data/ladder";
import { M1_FACTIONS, rosterFor } from "@/game/data/units";
import type { World } from "@/game/sim/World";
import { creditPayout, useProfiles } from "@/game/meta/profiles";
import { useGame, type Speed } from "@/store/gameStore";

const SPEEDS: Speed[] = [0.25, 0.5, 1, 2];

export function Hud({ world }: { world: World }) {
  const selected = useGame((s) => s.selected);
  const setSelected = useGame((s) => s.setSelected);
  const faction = useGame((s) => s.faction);
  const setFaction = useGame((s) => s.setFaction);
  const spent = useGame((s) => s.spent);
  const budget = useGame((s) => s.budget);
  const speed = useGame((s) => s.speed);
  const setSpeed = useGame((s) => s.setSpeed);
  const paused = useGame((s) => s.paused);
  const setPaused = useGame((s) => s.setPaused);
  const snapshot = useGame((s) => s.snapshot);
  const message = useGame((s) => s.message);
  const setMessage = useGame((s) => s.setMessage);
  const seat = useGame((s) => s.seat);
  const setSeat = useGame((s) => s.setSeat);
  const setPlacingSide = useGame((s) => s.setPlacingSide);
  const placingSide = useGame((s) => s.placingSide);
  const resetSpend = useGame((s) => s.resetSpend);
  const killFeed = useGame((s) => s.killFeed);
  const vsAI = useGame((s) => s.vsAI);
  const arena = useGame((s) => s.arena);
  const setArena = useGame((s) => s.setArena);
  const powerups = useGame((s) => s.powerups);
  const togglePowerup = useGame((s) => s.togglePowerup);
  const followId = useGame((s) => s.followId);
  const hoverId = useGame((s) => s.hoverId);
  const menuOpen = useGame((s) => s.menuOpen);
  const p1id = useProfiles((s) => s.p1);
  const p2id = useProfiles((s) => s.p2);
  const plist = useProfiles((s) => s.profiles);

  useEffect(() => {
    try {
      const boot = () => useProfiles.getState().ensureDefaults();
      const api = useProfiles.persist;
      const unsub = api?.onFinishHydration?.(boot);
      if (api?.hasHydrated?.()) boot();
      return typeof unsub === "function" ? unsub : undefined;
    } catch {
      useProfiles.getState().ensureDefaults();
    }
  }, []);

  const p1 = plist.find((p) => p.id === p1id);
  const p2 = plist.find((p) => p.id === p2id);
  const phase = snapshot?.phase ?? "setup";
  const cards = rosterFor(faction);

  const readyP1 = () => {
    if (world.units.filter((u) => u.side === 0).length < 1) {
      setMessage("P1 needs at least one unit.");
      return;
    }
    if (vsAI) {
      const lvl = LADDER.find((l) => l.id === useGame.getState().ladderLevel) ?? LADDER[0];
      for (const p of ladderArmy(lvl, 1)) {
        try {
          world.place(p);
        } catch {
          /* cap */
        }
      }
      useGame.getState().addSpend(1, lvl.army.reduce((n, a) => n + 0, 0));
      world.startCountdown(useGame.getState().powerups);
      const api = useProfiles.getState();
      api.usePowerups(api.p1, useGame.getState().powerups[0]);
      api.usePowerups(api.p2, useGame.getState().powerups[1]);
      useGame.getState().setSnapshot(world.snapshot());
      useGame.getState().setPaused(false);
      useGame.getState().setSpeed(1);
      setSeat("fight");
      setMessage(`${lvl.name} marches in.`);
      return;
    }
    setSeat("pass");
    setMessage("Pass the keyboard.");
  };

  const beginP2 = () => {
    setSeat("setupP2");
    setPlacingSide(1);
    setMessage("P2 — click the glowing red pad. Blue army is hidden.");
  };

  const go = () => {
    const sides = new Set(world.units.map((u) => u.side));
    if (sides.size < 2) {
      setMessage("Both sides need a unit.");
      return;
    }
    world.startCountdown();
    useGame.getState().setSnapshot(world.snapshot());
    useGame.getState().setPaused(false);
    useGame.getState().setSpeed(1);
    setSeat("fight");
    setMessage("Here they come.");
  };

  const rematch = () => {
    const stored = useGame.getState().placements;
    const placed =
      stored.length > 0
        ? stored
        : world.units.map((u) => ({
            defId: u.def.id,
            x: u.x,
            z: u.z,
            yaw: u.yaw,
            side: u.side,
          }));
    try {
      world.clearUnits();
      for (const p of placed) world.place(p);
      useGame.getState().setAwarded(false);
      useGame.getState().clearFeed();
      world.startCountdown(useGame.getState().powerups);
      const api = useProfiles.getState();
      api.usePowerups(api.p1, useGame.getState().powerups[0]);
      api.usePowerups(api.p2, useGame.getState().powerups[1]);
      useGame.getState().setSnapshot(world.snapshot());
      useGame.getState().setPaused(false);
      useGame.getState().setSpeed(1);
      setSeat("fight");
      setMessage("Rematch!");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Rematch failed.");
    }
  };

  const wipe = () => {
    try {
      world.clearUnits();
      resetSpend();
      useGame.getState().resetMatch();
      useGame.getState().setSnapshot(world.snapshot());
      setMessage("P1 — click the glowing blue pad.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not reset.");
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 text-ink md:p-4">
      <header className="pointer-events-auto flex flex-wrap items-start justify-between gap-3">
        <Link
          to="/"
          className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-3 py-1 font-display text-lg"
        >
          Wobble Wars
        </Link>
        {phase === "setup" && (
          <div className="toy-shadow flex gap-1 rounded-btn border-[3px] border-ink bg-cream p-1">
            {ARENAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setArena(a.id);
                  world.arena = a.id;
                }}
                className={`rounded-btn px-2 py-1 text-sm font-display ${arena === a.id ? "bg-ochre" : ""}`}
              >
                {a.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
        <div className="toy-shadow flex min-w-[240px] flex-col gap-1 rounded-card border-[3px] border-ink bg-cream/95 px-3 py-2">
          <div className="flex justify-between font-display text-lg">
            <span className="text-steel">
              {p1?.name ?? "P1"} {spent[0]}
            </span>
            <span className="text-muted">/ {budget}</span>
            <span className="text-crimson">
              {p2?.name ?? "P2"} {spent[1]}
            </span>
          </div>
          {phase === "setup" && (
            <div className="flex gap-1 text-xs">
              {[3000, 4500, 6000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => useGame.getState().setBudget(n)}
                  className={`rounded-btn border-[2px] border-ink px-2 py-0.5 ${budget === n ? "bg-ochre-hot" : "bg-parchment"}`}
                >
                  {n}
                </button>
              ))}
              {budget >= 6000 && <span className="text-crimson">will hitch</span>}
            </div>
          )}
          {snapshot && phase !== "setup" && (
            <div className="flex h-3 overflow-hidden rounded-full border-2 border-ink">
              <div
                className="bg-steel"
                style={{
                  width: `${(snapshot.counts[0] / Math.max(1, snapshot.counts[0] + snapshot.counts[1])) * 100}%`,
                }}
              />
              <div className="flex-1 bg-crimson" />
            </div>
          )}
          <p className="text-sm text-muted">{message}</p>
          <p className="text-xs text-muted">
            {snapshot?.units.length ?? 0} on the field
            {p1 && p2 ? ` · ${p1.credits} / ${p2.credits}¢` : ""}
          </p>
          {phase !== "setup" && snapshot && (
            <div className="mt-1 flex h-2 overflow-hidden rounded-btn border-[2px] border-ink">
              <span className="bg-steel" style={{ width: `${Math.max(4, (snapshot.counts[0] / Math.max(1, snapshot.counts[0] + snapshot.counts[1])) * 100)}%` }} />
              <span className="bg-crimson" style={{ flex: 1 }} />
            </div>
          )}
        </div>
      </header>

      {(seat === "setupP1" || seat === "setupP2") && phase === "setup" && (
        <div className="pointer-events-auto flex max-h-[70vh] max-w-[220px] flex-col gap-2 overflow-auto">
          <div className="flex flex-wrap gap-1">
            {([...M1_FACTIONS, "anomaly"] as const).map((id) => {
              if (id === "anomaly") {
                const unlocked = placingSide === 0 ? (p1?.anomalies?.length ?? 0) : (p2?.anomalies?.length ?? 0);
                if (!unlocked) return null;
              }
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFaction(id as FactionId)}
                  className={`toy-shadow rounded-btn border-[3px] border-ink px-2 py-1 text-sm font-display ${
                    faction === id ? "bg-ochre-hot" : "bg-parchment"
                  }`}
                >
                  {FACTION_META[id].name}
                </button>
              );
            })}
          </div>
          {cards
            .filter((u) => {
              if (u.faction !== "anomaly") return true;
              const bag = placingSide === 0 ? p1?.anomalies : p2?.anomalies;
              return bag?.includes(u.id);
            })
            .map((u) => {
            const on = selected.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected(u)}
                className={`toy-shadow w-[200px] rounded-card border-[3px] border-ink px-3 py-2 text-left ${
                  on ? "bg-ochre-hot" : "bg-parchment"
                }`}
              >
                <div className="mb-1 flex h-8 overflow-hidden rounded-btn border-[2px] border-ink">
                  <span className="w-1/2" style={{ background: u.palette.primary }} />
                  <span className="w-1/4" style={{ background: u.palette.skin }} />
                  <span className="w-1/4" style={{ background: u.palette.accent }} />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-lg">{u.name}</span>
                  <span className="font-display text-steel">{u.cost}</span>
                </div>
                <p className="text-xs text-muted">{u.blurb}</p>
              </button>
            );
          })}
          <div className="mt-2 flex flex-wrap gap-1">
            {POWERUPS.map((p) => {
              const bag = (placingSide === 0 ? p1?.powerups : p2?.powerups) ?? {};
              const owned = bag[p.id] ?? 0;
              if (owned <= 0) return null;
              const on = powerups[placingSide].includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePowerup(placingSide, p.id)}
                  className={`rounded-btn border-[3px] border-ink px-2 py-1 text-xs font-display ${on ? "bg-ochre-hot" : "bg-cream"}`}
                >
                  {p.name} ×{owned}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase !== "setup" && killFeed.length > 0 && (
        <ul className="pointer-events-none absolute left-4 top-28 space-y-1 text-sm text-cream drop-shadow-[2px_2px_0_#1c1710]">
          {killFeed.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
      )}

      <footer className="pointer-events-auto flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="toy-shadow flex gap-1 rounded-btn border-[3px] border-ink bg-cream p-1">
          <button type="button" className="rounded-btn px-3 py-2 font-display" onClick={() => setPaused(!paused)}>
            {paused ? "Play" : "Pause"}
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`rounded-btn px-3 py-2 font-display ${speed === s ? "bg-ochre" : ""}`}
            >
              {s}×
            </button>
          ))}
          </div>
          <p className="text-xs text-cream drop-shadow-[2px_2px_0_#1c1710]">
            Right-drag turn · wheel zoom · WASD move · Q/E spin · R reset
          </p>
          <div className="toy-shadow flex gap-1 rounded-btn border-[3px] border-ink bg-cream p-1">
            <button type="button" className="rounded-btn px-2 py-1 font-display" onClick={() => useGame.getState().bumpCam("yaw", -0.35)}>
              ⟲
            </button>
            <button type="button" className="rounded-btn px-2 py-1 font-display" onClick={() => useGame.getState().bumpCam("yaw", 0.35)}>
              ⟳
            </button>
            <button type="button" className="rounded-btn px-2 py-1 font-display" onClick={() => useGame.getState().bumpCam("pitch", -0.18)}>
              tilt
            </button>
            <button type="button" className="rounded-btn px-2 py-1 font-display" onClick={() => useGame.getState().bumpCam("pitch", 0.18)}>
              top
            </button>
            <button type="button" className="rounded-btn px-2 py-1 font-display" onClick={() => useGame.getState().bumpCam("zoom", -4)}>
              +
            </button>
            <button type="button" className="rounded-btn px-2 py-1 font-display" onClick={() => useGame.getState().bumpCam("zoom", 4)}>
              −
            </button>
            <button type="button" className="rounded-btn px-2 py-1 font-display" onClick={() => useGame.getState().bumpCam("reset")}>
              reset
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {seat === "setupP1" && phase === "setup" && (
            <>
              <button
                type="button"
                onClick={wipe}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const last = world.removeLast(0);
                  if (!last) return;
                  useGame.getState().popPlace();
                  useGame.getState().addSpend(0, -last.def.cost);
                  useGame.getState().setSnapshot(world.snapshot());
                }}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => {
                  world.mirrorSide(0);
                  useGame.getState().setSnapshot(world.snapshot());
                }}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display"
              >
                Flip
              </button>
              <button
                type="button"
                onClick={() => {
                  const units = world.units
                    .filter((u) => u.side === 0)
                    .map((u) => ({ defId: u.def.id, x: u.x, z: u.z, yaw: u.yaw, side: 0 as const }));
                  const who = useProfiles.getState().p1;
                  useProfiles.getState().saveArmy(who, "Hot-seat", units);
                  setMessage("Army saved.");
                }}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  const who = placingSide === 0 ? p1 : p2;
                  const army = who?.armies?.[0];
                  if (!army) {
                    setMessage("No saved army yet.");
                    return;
                  }
                  world.clearSide(placingSide);
                  for (const raw of army.units) {
                    try {
                      world.place({ ...raw, side: placingSide });
                    } catch {
                      /* cap */
                    }
                  }
                  useGame.getState().setSnapshot(world.snapshot());
                  setMessage(`Loaded ${army.name}.`);
                }}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display"
              >
                Load
              </button>
              <button
                type="button"
                onClick={readyP1}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-ochre-hot px-5 py-2 font-display text-xl"
              >
                Ready
              </button>
            </>
          )}
          {seat === "setupP2" && phase === "setup" && (
            <>
              <button
                type="button"
                onClick={wipe}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-3 py-2 font-display"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={go}
                className="toy-shadow rounded-btn border-[3px] border-ink bg-ochre-hot px-5 py-2 font-display text-xl"
              >
                GO
              </button>
            </>
          )}
          {phase === "countdown" && (
            <div className="font-display text-5xl text-cream drop-shadow-[4px_4px_0_#1c1710]">
              {Math.max(1, Math.ceil(snapshot?.countdown ?? world.countdown))}
            </div>
          )}
          {phase === "battle" && (
            <div className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-3 py-2 font-display">
              {snapshot ? Math.floor(snapshot.time) : 0}s / 120
              <span className="ml-2 text-sm text-muted">phys {snapshot?.physicsMs.toFixed(1)}ms</span>
              {(() => {
                const fu = snapshot?.units.find((u) => u.id === followId);
                if (!fu) return <span className="ml-2 text-sm text-muted">click a toy · F</span>;
                return (
                  <span className="ml-2 text-sm">
                    {fu.defId.split(".")[1]} {Math.ceil(fu.hp)}/{fu.maxHp}
                  </span>
                );
              })()}
            </div>
          )}
        </div>
      </footer>

      {seat === "pass" && <PassCurtain onDone={beginP2} />}
      {phase === "over" && <ResultsCard world={world} onRematch={rematch} onNew={wipe} />}
      {phase !== "setup" && hoverId != null && snapshot && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-btn border-[3px] border-ink bg-cream px-3 py-1 font-display text-ink">
          {(() => {
            const u = snapshot.units.find((n) => n.id === hoverId);
            if (!u) return null;
            return `${u.defId.split(".")[1]}  ${Math.ceil(u.hp)}/${u.maxHp}`;
          })()}
        </div>
      )}
      {menuOpen && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-ink/70" data-ui>
          <div className="toy-shadow w-full max-w-sm rounded-card border-[3px] border-ink bg-cream p-5 text-ink">
            <h2 className="font-display text-3xl">Paused</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="toy-shadow rounded-btn border-[3px] border-ink bg-ochre-hot px-4 py-2 font-display" onClick={() => useGame.getState().setMenuOpen(false)}>
                Resume
              </button>
              <Link
                to="/"
                className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-4 py-2 font-display text-center"
                onClick={(e) => {
                  if (phase !== "setup" && !window.confirm("Leave this fight?")) e.preventDefault();
                }}
              >
                Quit to title
              </Link>
            </div>
          </div>
        </div>
      )}
      {world.slowmoT > 0 && phase === "battle" && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <p className="font-display text-6xl text-cream drop-shadow-[6px_6px_0_#1c1710]">FINISH</p>
        </div>
      )}
    </div>
  );
}

function PassCurtain({ onDone }: { onDone: () => void }) {
  const [left, setLeft] = useState(3);
  useEffect(() => {
    const id = window.setInterval(() => setLeft((n) => n - 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/90 text-cream">
      <p className="font-display text-5xl">Pass to P2</p>
      <p className="mt-3 max-w-sm text-center text-lg text-cream/80">
        Look away. P1's army will be silhouettes only.
      </p>
      {left > 0 ? (
        <p className="mt-6 font-display text-6xl">{left}</p>
      ) : (
        <button
          type="button"
          onClick={onDone}
          className="toy-shadow mt-6 rounded-btn border-[3px] border-ink bg-ochre-hot px-6 py-3 font-display text-2xl text-ink"
        >
          I'm P2
        </button>
      )}
    </div>
  );
}

function ResultsCard({
  world,
  onRematch,
  onNew,
}: {
  world: World;
  onRematch: () => void;
  onNew: () => void;
}) {
  const snapshot = useGame((s) => s.snapshot);
  const awarded = useGame((s) => s.awarded);
  const stats = world.stats();
  const p1id = useProfiles((s) => s.p1);
  const p2id = useProfiles((s) => s.p2);
  const plist = useProfiles((s) => s.profiles);
  const pay = creditPayout(snapshot?.winner ?? "draw", stats.spent[snapshot?.winner === 0 ? 1 : 0] ?? 0, stats.mvpSide);

  useEffect(() => {
    if (awarded || !snapshot || snapshot.phase !== "over") return;
    const api = useProfiles.getState();
    api.addCredits(api.p1, pay.p1);
    api.addCredits(api.p2, pay.p2);
    api.recordBattle(api.p1, snapshot.winner === 0);
    api.recordBattle(api.p2, snapshot.winner === 1);
    useGame.getState().setAwarded(true);
  }, [awarded, snapshot, pay.p1, pay.p2]);

  const p1 = plist.find((p) => p.id === p1id);
  const p2 = plist.find((p) => p.id === p2id);
  const title =
    snapshot?.winner === "draw" ? "DRAW" : snapshot?.winner === 0 ? `${p1?.name ?? "P1"} WINS` : `${p2?.name ?? "P2"} WINS`;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/55 p-4" data-ui>
      <div className="toy-shadow w-full max-w-lg rounded-card border-[3px] border-ink bg-cream p-5 text-ink">
        <h2 className="font-display text-4xl">{title}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-card border-[3px] border-ink bg-parchment p-3">
            <p className="font-display text-xl">{p1?.name ?? "P1"}</p>
            <p>Spent {stats.spent[0]}</p>
            <p>Lost {stats.lost[0]}</p>
            <p>Damage {Math.round(stats.damage[0])}</p>
            <p className="mt-1 font-display text-ochre-hot">+{pay.p1} credits</p>
          </div>
          <div className="rounded-card border-[3px] border-ink bg-parchment p-3">
            <p className="font-display text-xl">{p2?.name ?? "P2"}</p>
            <p>Spent {stats.spent[1]}</p>
            <p>Lost {stats.lost[1]}</p>
            <p>Damage {Math.round(stats.damage[1])}</p>
            <p className="mt-1 font-display text-ochre-hot">+{pay.p2} credits</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          MVP: {stats.mvpName} ({stats.mvpSide === 0 ? "P1" : "P2"})
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRematch}
            className="toy-shadow rounded-btn border-[3px] border-ink bg-ochre-hot px-4 py-2 font-display"
          >
            Rematch
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onNew}
            className="toy-shadow rounded-btn border-[3px] border-ink bg-parchment px-4 py-2 font-display"
          >
            New armies
          </button>
          <Link
            to="/roll"
            onPointerDown={(e) => e.stopPropagation()}
            className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display"
          >
            Roll
          </Link>
          <Link
            to="/"
            onPointerDown={(e) => e.stopPropagation()}
            className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display"
          >
            Menu
          </Link>
        </div>
      </div>
    </div>
  );
}
