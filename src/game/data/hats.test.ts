import { describe, expect, it } from "vitest";
import { COSMETICS, PALETTES } from "./rolls";
import { getHat, HATS, isHatId } from "./hats";

describe("hats", () => {
  it("ships twelve named hats with unique ids", () => {
    expect(HATS).toHaveLength(12);
    const ids = HATS.map((h) => h.id);
    expect(new Set(ids).size).toBe(12);
    expect(ids).toContain("hat.cone");
    expect(ids).toContain("hat.crown");
    expect(ids).toContain("hat.tophat");
    expect(HATS.every((h) => h.parts.length >= 1)).toBe(true);
  });

  it("looks up by id and rejects junk", () => {
    expect(getHat("hat.halo")?.name).toBe("Halo");
    expect(getHat("hat.missing")).toBeNull();
    expect(isHatId("hat.cone")).toBe(true);
    expect(isHatId("pal.midnight")).toBe(false);
  });

  it("is on the roll table with every palette", () => {
    const hats = COSMETICS.filter((c) => c.id.startsWith("hat."));
    const pals = COSMETICS.filter((c) => c.id.startsWith("pal."));
    expect(hats).toHaveLength(12);
    expect(pals).toHaveLength(PALETTES.length);
    expect(PALETTES.length).toBe(8);
  });
});
