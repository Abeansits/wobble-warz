import { describe, expect, it } from "vitest";
import { ARENAS } from "@/game/data/arenas";
import {
  DUCK_RATIO,
  MUSIC_BEDS,
  PANNER,
  VOICE_CAP,
  duckMusic,
  musicBedFor,
  setListener,
  setMixer,
  sfx,
  startMusic,
  stopMusic,
} from "./audio";

describe("audio beds", () => {
  it("ships a menu loop and one bed per arena", () => {
    expect(Object.keys(MUSIC_BEDS).sort()).toEqual(["canyon", "graveyard", "meadow", "menu"].sort());
    for (const a of ARENAS) {
      expect(MUSIC_BEDS[a.id].notes.length).toBeGreaterThanOrEqual(8);
      expect(MUSIC_BEDS[a.id].interval).toBeGreaterThan(200);
    }
    expect(MUSIC_BEDS.meadow.notes).not.toEqual(MUSIC_BEDS.canyon.notes);
    expect(MUSIC_BEDS.canyon.notes).not.toEqual(MUSIC_BEDS.graveyard.notes);
  });

  it("picks menu on the title and the arena in battle", () => {
    expect(musicBedFor("canyon", true)).toBe("menu");
    expect(musicBedFor("graveyard")).toBe("graveyard");
  });

  it("ducks 6dB and caps concurrent voices", () => {
    expect(DUCK_RATIO).toBeCloseTo(0.5);
    expect(VOICE_CAP).toBe(24);
    expect(PANNER.panningModel).toBe("equalpower");
    expect(PANNER.refDistance).toBeLessThan(PANNER.maxDistance);
  });

  it("is a no-op without a window AudioContext", () => {
    expect(typeof window).toBe("undefined");
    setMixer(0.7, 0.6, 0.8);
    sfx("hit", 0.4, { x: -8, y: 1, z: 0 });
    sfx("win", 0.5);
    startMusic("canyon", 0.4);
    duckMusic(true);
    setListener(0, 12, 32, 0, -0.4, -1);
    stopMusic();
  });
});
