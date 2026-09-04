import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FACTION_META, type FactionId } from "@/game/data/types";
import { ARENAS } from "@/game/data/arenas";
import { POWERUPS, ROLL_COST } from "@/game/data/rolls";
import { LADDER, ladderArmy } from "@/game/data/ladder";
import { M1_FACTIONS, getUnit, rosterFor } from "@/game/data/units";
import type { World } from "@/game/sim/World";
import { creditPayout, DAILY_BATTLE_BONUS, ladderPayout, localDateKey, useProfiles } from "@/game/meta/profiles";
import { useGame, type Speed } from "@/store/gameStore";
import { deployYaw } from "@/game/sim/facing";
import { BUDGET_WARN } from "@/game/setup";
import { ToyButton, ToyPanel, ToyTray } from "@/ui/ToyButton";

const SPEEDS: Speed[] = [0.25, 0.5, 1, 2];

const EMBLEM_POS: Record<string, string> = {
  stoneage: "0% 0%",
  medieval: "50% 0%",
  pirate: "100% 0%",
  frontier: "0% 100%",
  haunted: "50% 100%",
  anomaly: "100% 100%",
};

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
  const meProfile = placingSide === 0 ? p1 : p2;
  const newAnomalies = meProfile?.newAnomalies ?? [];

  useEffect(() => {
    if (menuOpen) setPaused(true);
  }, [menuOpen, setPaused]);

  useEffect(() => {
    if (phase === "countdown") setMessage("Don't blink.");
    if (phase === "battle") setMessage("");
    if (phase === "over") setMessage("That's the whistle.");
  }, [phase, setMessage]);

  const undoSide = () => {
    const last = world.removeLast(placingSide);
    if (!last) return;
    useGame.getState().popPlace();
    useGame.getState().addSpend(placingSide, -last.def.cost);
    useGame.getState().setSnapshot(world.snapshot());
  };

  const redoSide = () => {
    const p = useGame.getState().redoPlace();
    if (!p || p.side !== placingSide) return;
    try {
      world.place(p);
      useGame.getState().addSpend(placingSide, getUnit(p.defId).cost);
      useGame.getState().setSnapshot(world.snapshot());
    } catch {
      /* */
    }
  };

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
      useGame.getState().addSpend(
        1,
        lvl.army.reduce((n, a) => n + a.count * getUnit(a.defId).cost, 0),
      );
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
    world.startCountdown(useGame.getState().powerups);
    const api = useProfiles.getState();
    api.usePowerups(api.p1, useGame.getState().powerups[0]);
    api.usePowerups(api.p2, useGame.getState().powerups[1]);
    useGame.getState().setSnapshot(world.snapshot());
    useGame.getState().setPaused(false);
    useGame.getState().setSpeed(1);
    setSeat("fight");
    setMessage("Here they come.");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useGame.getState();
      const ph = st.snapshot?.phase ?? "setup";
      if (e.code === "Enter" && ph === "setup") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        if (st.seat === "setupP1") readyP1();
        if (st.seat === "setupP2") go();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (ph === "setup") undoSide();
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        if (ph === "setup") redoSide();
      }
      if ((e.code === "Delete" || e.code === "Backspace") && ph === "setup") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        undoSide();
      }
      if (e.code === "KeyM" && ph === "setup") {
        world.mirrorSide(st.placingSide);
        st.setSnapshot(world.snapshot());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rematch = () => {
    try {
      if (world.layout.length === 0) {
        const stored = useGame.getState().placements;
        world.layout =
          stored.length > 0
            ? stored.map((p) => ({ ...p }))
            : world.units
                .filter((u) => !u.summoned)
                .map((u) => ({ defId: u.def.id, x: u.x, z: u.z, yaw: deployYaw(u.side), side: u.side }));
      }
      world.replay();
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

  const clearField = () => {
    try {
      world.clearUnits();
      resetSpend();
      useGame.getState().setSnapshot(world.snapshot());
      setMessage(placingSide === 0 ? "P1 — click the glowing blue pad." : "P2 — click the glowing red pad.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not clear.");
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

  const restartOrRematch = () => {
    useGame.getState().setMenuOpen(false);
    if (phase === "setup" && world.layout.length === 0) {
      clearField();
      return;
    }
    rematch();
  };

  const surrender = () => {
    const st = useGame.getState();
    const loser: 0 | 1 = st.vsAI || st.seat !== "setupP2" ? 0 : 1;
    const winner: 0 | 1 = loser === 0 ? 1 : 0;
    for (const u of world.units) {
      if (u.side !== loser || u.state === "dead" || u.gone) continue;
      try {
        world.kill(u, null);
      } catch {
        /* */
      }
    }
    world.phase = "over";
    world.winner = winner;
    st.setMenuOpen(false);
    st.setPaused(false);
    st.setSeat("results");
    st.setSnapshot(world.snapshot());
    setMessage("Surrendered.");
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col p-3 text-ink md:p-4">
      <header className="pointer-events-auto flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToyButton variant="secondary" size="sm" asChild>
            <Link to="/">Wobble Wars</Link>
          </ToyButton>
          {phase === "setup" && (
            <ToyTray>
              {ARENAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setArena(a.id);
                    world.setArena(a.id);
                    useGame.getState().setSnapshot(world.snapshot());
                  }}
                  className={`min-h-11 rounded-btn px-3 py-2 text-sm font-display transition-colors duration-150 ${arena === a.id ? "bg-ochre-hot" : "hover:bg-parchment"}`}
                >
                  {a.name.split(" ")[0]}
                </button>
              ))}
            </ToyTray>
          )}
        </div>
        <ToyPanel className="min-w-[220px] px-3 py-2">
          <div className="flex items-baseline justify-between gap-3 font-display text-lg tabular-nums">
            <span className="text-steel">
              {p1?.name ?? "P1"} {spent[0]}
            </span>
            <span className="text-muted">/{budget}</span>
            <span className="text-crimson">
              {p2?.name ?? "P2"} {spent[1]}
            </span>
          </div>
          {phase === "setup" && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {[1500, 3000, 6000].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={vsAI}
                  onClick={() => useGame.getState().setBudget(n)}
                  className={`min-h-9 rounded-btn px-2 text-xs font-display tabular-nums disabled:opacity-60 ${budget === n ? "bg-ochre-hot" : "bg-parchment hover:bg-cream"}`}
                >
                  {n}
                </button>
              ))}
              {budget >= BUDGET_WARN && <span className="text-xs text-crimson">will hitch</span>}
            </div>
          )}
          {snapshot && phase !== "setup" && (
            <div className="mt-1 flex h-3 overflow-hidden rounded-full border-2 border-ink">
              <div
                className="bg-steel"
                style={{
                  width: `${(snapshot.counts[0] / Math.max(1, snapshot.counts[0] + snapshot.counts[1])) * 100}%`,
                }}
              />
              <div className="flex-1 bg-crimson" />
            </div>
          )}
          {message ? <p className="mt-1 text-sm text-muted">{message}</p> : null}
        </ToyPanel>
      </header>

      <div className="flex min-h-0 flex-1 items-start pt-2">
      {(seat === "setupP1" || seat === "setupP2") && phase === "setup" && (
        <ToyPanel className="pointer-events-auto w-52">
          <div className="flex border-b-[3px] border-ink">
            {([...M1_FACTIONS, "anomaly"] as const).map((id) => {
              if (id === "anomaly") {
                const unlocked = placingSide === 0 ? (p1?.anomalies?.length ?? 0) : (p2?.anomalies?.length ?? 0);
                if (!unlocked) return null;
              }
              const on = faction === id;
              return (
                <button
                  key={id}
                  type="button"
                  title={FACTION_META[id].name}
                  onClick={() => setFaction(id as FactionId)}
                  className={`relative flex min-h-11 flex-1 items-center justify-center ${on ? "bg-ochre-hot" : "hover:bg-parchment"}`}
                >
                  <span
                    className="inline-block h-6 w-6 rounded-sm border-[2px] border-ink bg-cover"
                    style={{
                      backgroundImage: "url(/assets/emblems.png)",
                      backgroundSize: "300% 200%",
                      backgroundPosition: EMBLEM_POS[id],
                    }}
                  />
                  {id === "anomaly" && newAnomalies.length > 0 && (
                    <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-ochre-hot ring-2 ring-ink" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="max-h-[min(48vh,22rem)] overflow-auto">
            {cards
              .filter((u) => {
                if (u.faction !== "anomaly") return true;
                const bag = placingSide === 0 ? p1?.anomalies : p2?.anomalies;
                return bag?.includes(u.id);
              })
              .map((u) => {
                const on = selected.id === u.id;
                const isNew = u.faction === "anomaly" && newAnomalies.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelected(u);
                      if (isNew) {
                        const who = placingSide === 0 ? p1id : p2id;
                        if (who) useProfiles.getState().clearNewAnomaly(who, u.id);
                      }
                    }}
                    className={`flex w-full min-h-11 items-center gap-2 px-2 py-1.5 text-left ${on ? "bg-ochre-hot" : "hover:bg-parchment"}`}
                  >
                    <span
                      className="h-7 w-7 shrink-0 overflow-hidden rounded-sm border-[2px] border-ink"
                      style={{ background: u.palette.primary }}
                    >
                      <span className="block h-1/2 w-full" style={{ background: u.palette.skin }} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-display">{u.name}</span>
                    <span className="font-display text-sm tabular-nums text-steel">{u.cost}</span>
                    {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-ochre-hot ring-2 ring-ink" />}
                  </button>
                );
              })}
          </div>
          <p className="border-t-[3px] border-ink px-2 py-1.5 text-xs text-muted">{selected.blurb}</p>
          {POWERUPS.some((p) => ((placingSide === 0 ? p1?.powerups : p2?.powerups) ?? {})[p.id]) && (
            <div className="flex flex-wrap gap-1 border-t-[3px] border-ink p-1">
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
                    className={`min-h-9 rounded-btn px-2 text-xs font-display ${on ? "bg-ochre-hot" : "bg-parchment hover:bg-cream"}`}
                  >
                    {p.name} ×{owned}
                  </button>
                );
              })}
            </div>
          )}
        </ToyPanel>
      )}
      </div>

      {phase !== "setup" && phase !== "over" && killFeed.length > 0 && (
        <ul className="pointer-events-none absolute left-4 top-28 space-y-1 text-sm text-cream drop-shadow-[2px_2px_0_#1c1710]">
          {killFeed.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
      )}

      <footer className="pointer-events-auto flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          {phase !== "setup" && (
            <>
            <ToyTray>
              <button type="button" className="min-h-11 rounded-btn px-3 py-2 font-display hover:bg-parchment" onClick={() => setPaused(!paused)}>
                {paused ? "Play" : "Pause"}
              </button>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`min-h-11 rounded-btn px-3 py-2 font-display tabular-nums transition-colors duration-150 ${speed === s ? "bg-ochre-hot" : "hover:bg-parchment"}`}
                >
                  {s}×
                </button>
              ))}
            </ToyTray>
              <p className="text-xs text-cream drop-shadow-[2px_2px_0_#1c1710]">
                Right-drag turn · wheel zoom · WASD move · Q/E spin · R reset
              </p>
              <ToyTray>
            {(
              [
                ["⟲", () => useGame.getState().bumpCam("yaw", -0.35), "Yaw left"],
                ["⟳", () => useGame.getState().bumpCam("yaw", 0.35), "Yaw right"],
                ["tilt", () => useGame.getState().bumpCam("pitch", -0.18), "Tilt"],
                ["top", () => useGame.getState().bumpCam("pitch", 0.18), "Top down"],
                ["+", () => useGame.getState().bumpCam("zoom", -4), "Zoom in"],
                ["−", () => useGame.getState().bumpCam("zoom", 4), "Zoom out"],
                ["reset", () => useGame.getState().bumpCam("reset"), "Reset camera"],
              ] as const
            ).map(([label, fn, title]) => (
              <button
                key={title}
                type="button"
                title={title}
                onClick={fn}
                className="min-h-11 rounded-btn px-2.5 py-1 font-display hover:bg-parchment"
              >
                {label}
              </button>
            ))}
              </ToyTray>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {seat === "setupP1" && phase === "setup" && (
            <>
              <ToyButton variant="ghost" size="sm" onClick={clearField}>
                Clear
              </ToyButton>
              <ToyButton variant="ghost" size="sm" onClick={undoSide}>
                Undo
              </ToyButton>
              <ToyButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  world.mirrorSide(0);
                  useGame.getState().setSnapshot(world.snapshot());
                }}
              >
                Flip
              </ToyButton>
              <ToyButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  const units = world.units
                    .filter((u) => u.side === 0)
                    .map((u) => ({ defId: u.def.id, x: u.x, z: u.z, yaw: u.yaw, side: 0 as const }));
                  const who = useProfiles.getState().p1;
                  useProfiles.getState().saveArmy(who, "Hot-seat", units);
                  setMessage("Army saved.");
                }}
              >
                Save
              </ToyButton>
              <ToyButton
                variant="ghost"
                size="sm"
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
              >
                Load
              </ToyButton>
              <ToyButton variant="primary" size="lg" onClick={readyP1}>
                Ready
              </ToyButton>
            </>
          )}
          {seat === "setupP2" && phase === "setup" && (
            <>
              <ToyButton variant="ghost" size="sm" onClick={undoSide}>
                Undo
              </ToyButton>
              <ToyButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  world.mirrorSide(1);
                  useGame.getState().setSnapshot(world.snapshot());
                }}
              >
                Flip
              </ToyButton>
              <ToyButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  const units = world.units
                    .filter((u) => u.side === 1)
                    .map((u) => ({ defId: u.def.id, x: u.x, z: u.z, yaw: u.yaw, side: 1 as const }));
                  const who = useProfiles.getState().p2;
                  useProfiles.getState().saveArmy(who, "Hot-seat", units);
                  setMessage("Army saved.");
                }}
              >
                Save
              </ToyButton>
              <ToyButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  const who = p2;
                  const army = who?.armies?.[0];
                  if (!army) {
                    setMessage("No saved army yet.");
                    return;
                  }
                  world.clearSide(1);
                  for (const raw of army.units) {
                    try {
                      world.place({ ...raw, side: 1 });
                    } catch {
                      /* cap */
                    }
                  }
                  useGame.getState().setSnapshot(world.snapshot());
                  setMessage(`Loaded ${army.name}.`);
                }}
              >
                Load
              </ToyButton>
              <ToyButton variant="primary" size="lg" onClick={go}>
                GO
              </ToyButton>
            </>
          )}
          {phase === "countdown" && (
            <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
              <p className="font-display text-[9rem] leading-none text-cream drop-shadow-[8px_8px_0_#1c1710]">
                {Math.max(1, Math.ceil(snapshot?.countdown ?? world.countdown))}
              </p>
            </div>
          )}
          {phase === "battle" && (
            <div className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-3 py-2 font-display">
              {snapshot ? Math.floor(snapshot.time) : 0}s / 120
              {typeof window !== "undefined" && window.location.search.includes("debug") && (
                <span className="ml-2 text-sm text-muted">
                  phys {snapshot?.physicsMs.toFixed(1)}ms
                  {snapshot && snapshot.wasmBytes > 0
                    ? ` · wasm ${(snapshot.wasmBytes / 1_048_576).toFixed(1)}MB`
                    : ""}
                </span>
              )}
              {snapshot?.degraded && (
                <span className="ml-2 text-ochre-hot" title="Physics is heavy — LOD and corpses are thinning">
                  ⚡
                </span>
              )}
              {(() => {
                const fu = snapshot?.units.find((u) => u.id === followId);
                if (!fu) return <span className="ml-2 text-sm text-muted">click a toy · F</span>;
                return (
                  <button
                    type="button"
                    className="ml-2 text-sm underline decoration-2 underline-offset-2"
                    onClick={() => useGame.getState().setFollowId(null)}
                  >
                    following {getUnit(fu.defId).name} · click to back off
                  </button>
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
              <ToyButton
                variant="primary"
                onClick={() => {
                  useGame.getState().setMenuOpen(false);
                  useGame.getState().setPaused(false);
                }}
              >
                Resume
              </ToyButton>
              <ToyButton variant="ghost" onClick={restartOrRematch}>
                {phase === "setup" && world.layout.length === 0 ? "Restart" : "Rematch"}
              </ToyButton>
              <ToyButton variant="ghost" onClick={surrender}>
                Surrender
              </ToyButton>
              <ToyButton variant="ghost" asChild>
                <Link
                  to="/settings"
                  onClick={(e) => {
                    if (phase !== "setup" && !window.confirm("Leave this fight?")) e.preventDefault();
                  }}
                >
                  Settings
                </Link>
              </ToyButton>
              <ToyButton variant="ghost" asChild>
                <Link
                  to="/"
                  onClick={(e) => {
                    if (phase !== "setup" && !window.confirm("Leave this fight?")) e.preventDefault();
                  }}
                >
                  Quit to title
                </Link>
              </ToyButton>
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
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center bg-ink/90 text-cream">
      <p className="font-display text-5xl">Pass to P2</p>
      <p className="mt-3 max-w-sm text-center text-lg text-cream/80">
        Look away. P1's army will be silhouettes only.
      </p>
      <ToyButton variant="primary" size="lg" className="mt-6" onClick={onDone}>
        I'm P2
      </ToyButton>
    </div>
  );
}

function CreditCount({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) * (1 - t);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <p className="mt-1 font-display text-ochre-hot">+{shown} credits</p>;
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
  const vsAI = useGame((s) => s.vsAI);
  const ladderLevel = useGame((s) => s.ladderLevel);
  const stats = world.stats();
  const p1id = useProfiles((s) => s.p1);
  const p2id = useProfiles((s) => s.p2);
  const plist = useProfiles((s) => s.profiles);
  const [daily, setDaily] = useState({ p1: 0, p2: 0 });
  const hotseat = creditPayout(snapshot?.winner ?? "draw", stats.spent[snapshot?.winner === 0 ? 1 : 0] ?? 0, stats.mvpSide);
  const firstLadder = vsAI && ladderLevel != null && (plist.find((p) => p.id === p1id)?.ladderProgress ?? 0) < ladderLevel;
  const pay = vsAI && ladderLevel != null
    ? { p1: ladderPayout(ladderLevel, firstLadder) + (stats.mvpSide === 0 ? 20 : 0), p2: 0 }
    : hotseat;

  useEffect(() => {
    if (awarded || !snapshot || snapshot.phase !== "over") return;
    const api = useProfiles.getState();
    const d1 = api.claimDailyBonus(api.p1);
    const d2 = vsAI ? 0 : api.claimDailyBonus(api.p2);
    setDaily({ p1: d1, p2: d2 });
    api.addCredits(api.p1, pay.p1 + d1);
    if (!vsAI) {
      api.addCredits(api.p2, pay.p2 + d2);
      api.recordBattle(api.p1, snapshot.winner === 0);
      api.recordBattle(api.p2, snapshot.winner === 1);
    } else {
      api.recordBattle(api.p1, snapshot.winner === 0);
      if (snapshot.winner === 0 && ladderLevel != null) api.recordLadder(api.p1, ladderLevel);
    }
    useGame.getState().setAwarded(true);
  }, [awarded, snapshot, pay.p1, pay.p2, vsAI, ladderLevel]);

  const p1 = plist.find((p) => p.id === p1id);
  const p2 = plist.find((p) => p.id === p2id);
  const today = localDateKey();
  const peekDaily = (date: string | undefined) => (date === today ? 0 : DAILY_BATTLE_BONUS);
  const p1Shown = pay.p1 + (awarded ? daily.p1 : peekDaily(p1?.dailyBonusDate));
  const p2Shown = pay.p2 + (awarded ? daily.p2 : vsAI ? 0 : peekDaily(p2?.dailyBonusDate));
  const p1Bank = (p1?.credits ?? 0) + (awarded ? 0 : p1Shown);
  const p2Bank = vsAI ? 0 : (p2?.credits ?? 0) + (awarded ? 0 : p2Shown);
  const canRoll = p1Bank >= ROLL_COST || p2Bank >= ROLL_COST;
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
            <CreditCount value={p1Shown} />
            {p1Shown > pay.p1 && <p className="text-xs text-muted">includes daily +{p1Shown - pay.p1}</p>}
          </div>
          <div className="rounded-card border-[3px] border-ink bg-parchment p-3">
            <p className="font-display text-xl">{p2?.name ?? "P2"}</p>
            <p>Spent {stats.spent[1]}</p>
            <p>Lost {stats.lost[1]}</p>
            <p>Damage {Math.round(stats.damage[1])}</p>
            <CreditCount value={p2Shown} />
            {p2Shown > pay.p2 && <p className="text-xs text-muted">includes daily +{p2Shown - pay.p2}</p>}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          MVP: {stats.mvpName} ({stats.mvpSide === 0 ? "P1" : "P2"})
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ToyButton variant="primary" onPointerDown={(e) => e.stopPropagation()} onClick={onRematch}>
            Rematch
          </ToyButton>
          <ToyButton variant="ghost" onPointerDown={(e) => e.stopPropagation()} onClick={onNew}>
            New armies
          </ToyButton>
          {canRoll && (
            <ToyButton variant="secondary" asChild>
              <Link to="/roll" onPointerDown={(e) => e.stopPropagation()}>
                Roll
              </Link>
            </ToyButton>
          )}
          <ToyButton variant="secondary" asChild>
            <Link to="/" onPointerDown={(e) => e.stopPropagation()}>
              Menu
            </Link>
          </ToyButton>
        </div>
      </div>
    </div>
  );
}
