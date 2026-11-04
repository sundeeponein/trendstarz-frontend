/**
 * Premium/unlock payment amount in rupees. New rows carry amountPaise (always
 * paise); older rows only have `amount`, whose unit depends on the gateway —
 * Razorpay rows paise, manual UPI/QR rows rupees. Mirrors the backend's
 * payment/payment-amount.util.ts.
 */
export function paymentAmountRupees(payment: any): number {
  if (!payment) return 0;
  if (typeof payment.amountPaise === 'number') return payment.amountPaise / 100;
  const amount = Number(payment.amount || 0);
  if (!Number.isFinite(amount)) return 0;
  const razorpay = payment.gatewayProvider === 'razorpay' || payment.paymentMethod === 'razorpay';
  return razorpay ? amount / 100 : amount;
}
