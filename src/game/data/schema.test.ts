import { describe, expect, it } from "vitest";
import { AUDIO_KEYS } from "./types";
import { UnitDefSchema, defaultAudio, parseRoster } from "./schema";
import { UNITS } from "./units";

describe("UnitDef schema", () => {
  it("parses the whole roster with audio keys", () => {
    const ids = Object.keys(UNITS);
    expect(ids.length).toBeGreaterThanOrEqual(38);
    for (const u of Object.values(UNITS)) {
      expect(AUDIO_KEYS).toContain(u.audio.attack);
      expect(AUDIO_KEYS).toContain(u.audio.hit);
      expect(AUDIO_KEYS).toContain(u.audio.death);
      expect(u.recipe.parts.length).toBeGreaterThan(0);
    }
  });

  it("fills default audio from the weapon", () => {
    expect(defaultAudio({ kind: "melee", damage: 1, knockback: 1, range: 1, cooldown: 1, swingSeconds: 0.2 })).toEqual({
      attack: "swing",
      hit: "hit",
      death: "yelp",
    });
    expect(defaultAudio({ kind: "explosive", damage: 1, knockback: 1, range: 1, cooldown: 1, speed: 8, arc: 2 })).toEqual({
      attack: "boom",
      hit: "boom",
      death: "yelp",
    });
  });

  it("rejects a unit with a bad id or palette", () => {
    const clubber = UNITS["stoneage.clubber"];
    expect(() => UnitDefSchema.parse({ ...clubber, id: "" })).toThrow();
    expect(() => UnitDefSchema.parse({ ...clubber, palette: { ...clubber.palette, primary: "blue" } })).toThrow();
  });

  it("requires the record key to match unit.id", () => {
    expect(() => parseRoster({ "wrong.key": UNITS["stoneage.clubber"] })).toThrow(/does not match/);
  });
});
