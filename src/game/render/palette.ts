export const TEAM = ["#3a5f8a", "#b33a2b"] as const;
export const WOOD = "#6b4a28";
export const METAL = "#9aa3ad";

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
