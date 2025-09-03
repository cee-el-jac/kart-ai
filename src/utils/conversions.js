// src/utils/conversions.js

// constants
export const LB_PER_KG = 2.20462;
export const L_PER_GAL = 3.78541;

// Grocery price normalization
export function toPerKg(price, unit) {
  if (unit === "/kg")   return price;
  if (unit === "/lb")   return price * LB_PER_KG; // $/lb -> $/kg
  if (unit === "/100g") return price * 10;        // $/100g -> $/kg
  return null;
}
export function toPerLb(price, unit) {
  const perKg = toPerKg(price, unit);
  return perKg == null ? null : perKg / LB_PER_KG; // $/kg -> $/lb
}

// Gas price normalization
export function toPerGal(price, unit) {
  if (unit === "/gal") return price;
  if (unit === "/L")   return price * L_PER_GAL;   // $/L -> $/gal
  return null;
}
export function toPerL(price, unit) {
  const perGal = toPerGal(price, unit);
  return perGal == null ? null : perGal / L_PER_GAL; // $/gal -> $/L
}

// Format helper
export function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `$${n.toFixed(2)}`;
}
