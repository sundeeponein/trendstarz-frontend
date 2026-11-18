/**
 * The creator side of a paid collaboration, in paise — the same rule as the
 * backend's payments-payouts/fee-rates.util.ts creatorPayoutBreakdown:
 *   fee = amount × fee%;  gst = fee × gst%;  payout = amount − fee − gst
 */
export function creatorPayoutBreakdown(
  agreedPaise: number,
  feePercent: number,
  gstPercent: number,
): { fee: number; gst: number; payout: number } {
  const amount = Math.max(Math.round(Number(agreedPaise || 0)), 0);
  const pct = Number(feePercent || 0);
  const fee = pct > 0 ? Math.round((amount * pct) / 100) : 0;
  const gstPct = Number(gstPercent || 0);
  const gst = fee > 0 && gstPct > 0 ? Math.round((fee * gstPct) / 100) : 0;
  return { fee, gst, payout: Math.max(amount - fee - gst, 0) };
}

/** ₹ with paise only when there are any: ₹976.40, ₹980. */
export function formatRupeesFromPaise(paise: number): string {
  const rupees = Number(paise || 0) / 100;
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
