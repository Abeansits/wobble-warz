export const TEAM = ["#3a5f8a", "#b33a2b"] as const;
export const WOOD = "#6b4a28";
export const METAL = "#9aa3ad";

export const COSMETIC_PALETTES: Record<string, { primary: string; secondary: string; accent: string; skin: string }> = {
  "pal.midnight": { primary: "#1b2a44", secondary: "#8a93a0", accent: "#d4a017", skin: "#e6c2a0" },
  "pal.ghost": { primary: "#4a6a68", secondary: "#d8ece8", accent: "#c9d4de", skin: "#e8fff4" },
  "pal.pumpkin": { primary: "#c45a18", secondary: "#2e5a2c", accent: "#d4a017", skin: "#e2b089" },
  "pal.bone": { primary: "#d9c9a4", secondary: "#6b4a28", accent: "#8fbf5a", skin: "#efe0b4" },
  "pal.royal": { primary: "#2a3a8a", secondary: "#c9cdd3", accent: "#b33a2b", skin: "#e6c2a0" },
  "pal.rust": { primary: "#8a3a28", secondary: "#c48a3a", accent: "#d4a017", skin: "#e2b089" },
  "pal.moss": { primary: "#2e5a2c", secondary: "#6b4a28", accent: "#8fbf5a", skin: "#e2b089" },
  "pal.ink": { primary: "#1c1710", secondary: "#6b4a28", accent: "#c48a3a", skin: "#e6c2a0" },
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
