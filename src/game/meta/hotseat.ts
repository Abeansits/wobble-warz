import { useGame } from "@/store/gameStore";
import { useProfiles } from "./profiles";

export type HotseatStart = { ok: true } | { ok: false; reason: "seats" | "same" };

/** Seat Blue/Red if needed, reset the match, and say whether we can skip the profile page. */
export function startHotseat(): HotseatStart {
  useProfiles.getState().ensureDefaults();
  const s = useProfiles.getState();
  if (!s.p1 || !s.p2) return { ok: false, reason: "seats" };
  if (s.p1 === s.p2) return { ok: false, reason: "same" };
  useGame.getState().resetMatch();
  return { ok: true };
}
