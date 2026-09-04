export const TEAM = ["#3a5f8a", "#b33a2b"] as const;
export const WOOD = "#6b4a28";
export const METAL = "#9aa3ad";

export const COSMETIC_PALETTES: Record<string, { primary: string; secondary: string; accent: string; skin: string }> = {
  "pal.midnight": { primary: "#1b2a44", secondary: "#8a93a0", accent: "#d4a017", skin: "#e6c2a0" },
  "pal.ghost": { primary: "#4a6a68", secondary: "#d8ece8", accent: "#c9d4de", skin: "#e8fff4" },
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
