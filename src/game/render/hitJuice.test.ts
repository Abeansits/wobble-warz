import { describe, expect, it } from "vitest";
import { addTrauma, hitJuice, stepTrauma, traumaOffset } from "./hitJuice";

describe("hitJuice", () => {
  it("gives a Clubber-sized hit more than a Squire tap", () => {
    const tap = hitJuice(10);
    const club = hitJuice(18);
    expect(club.volume).toBeGreaterThan(tap.volume);
    expect(club.particles).toBeGreaterThan(tap.particles);
    expect(club.trauma).toBeGreaterThan(tap.trauma);
    expect(tap.particles).toBeGreaterThanOrEqual(2);
    expect(tap.volume).toBeGreaterThan(0);
  });

  it("turns a kb-40 launch into a meaty burst", () => {
    const j = hitJuice(40);
    expect(j.particles).toBeGreaterThanOrEqual(12);
    expect(j.trauma).toBeCloseTo(0.45);
    expect(j.volume).toBeGreaterThan(0.4);
  });

  it("caps a cannon hit so a scrum cannot earthquake", () => {
    const j = hitJuice(400);
    expect(j.volume).toBe(0.55);
    expect(j.particles).toBe(16);
    expect(j.trauma).toBe(1);
    expect(j.speed).toBe(7);
  });

  it("still ticks at impulse 0 so every connect is audible", () => {
    const j = hitJuice(0);
    expect(j.volume).toBeGreaterThan(0);
    expect(j.particles).toBe(2);
    expect(j.trauma).toBe(0);
  });
});

describe("trauma", () => {
  it("adds and decays without going negative or past 1", () => {
    expect(addTrauma(0.8, 0.5)).toBe(1);
    expect(stepTrauma(1, 0.25)).toBeCloseTo(0.5);
    expect(stepTrauma(0.01, 1)).toBe(0);
  });

  it("offsets nothing at rest and jitters at full punch", () => {
    expect(traumaOffset(0, 1.2)).toEqual({ x: 0, y: 0, z: 0 });
    const o = traumaOffset(1, 0.4);
    expect(Math.hypot(o.x, o.y, o.z)).toBeGreaterThan(0.05);
  });
});
