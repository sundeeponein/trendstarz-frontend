/**
 * UPI ID (VPA) format: handle@bank, e.g. 9876543210@ybl.
 * Keep in sync with trendstarz-backend/src/utils/upi.util.ts.
 */
const UPI_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/;

/** Why this UPI ID can't be right, or null. An empty value is allowed (not given). */
export function upiIdError(value: unknown): string | null {
  const upi = String(value ?? '').trim().toLowerCase();
  if (!upi) return null;
  return UPI_ID_PATTERN.test(upi)
    ? null
    : "That UPI ID doesn't look right. It should look like name@bank (for example 9876543210@ybl).";
}

/** A UPI ID that payouts can be sent to (present and well-formed). */
export function hasValidUpiId(value: unknown): boolean {
  return !!String(value ?? '').trim() && !upiIdError(value);
}

/** Reactive-forms check for a UPI ID field: { upiId: message } when mistyped; empty is fine. */
export function upiIdValidator(control: { value: unknown }): { upiId: string } | null {
  const error = upiIdError(control?.value);
  return error ? { upiId: error } : null;
}
