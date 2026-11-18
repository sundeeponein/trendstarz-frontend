/**
 * 3D-1d: the lowest content rate (₹) a creator may set — mirrors the backend's
 * MINIMUM_RATE_RUPEES (utils/social-account.util.ts), which enforces it on save.
 * Rates already saved below it are kept until the creator changes them.
 */
export const MINIMUM_RATE_RUPEES = 50;

/** A typed rate that the server would refuse (0/empty is "no price yet", not too low). */
export function isBelowMinimumRate(price: unknown): boolean {
  const n = Number(price);
  return Number.isFinite(n) && n > 0 && n < MINIMUM_RATE_RUPEES;
}
