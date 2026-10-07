/**
 * Creator submission window — mirrors the backend's submissionWindow
 * (trendstarz-backend src/campaigns/campaign-deadlines.util.ts) exactly:
 * post date + 24h (+24h grace unless "strict"), never less than 48h after the
 * payment was confirmed, and never before an admin extension.
 */
const HOUR_MS = 60 * 60 * 1000;
export const SUBMIT_HOURS_AFTER_PAYMENT = 48;

function toTime(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const t = new Date(value as any).getTime();
  return Number.isFinite(t) ? t : null;
}

export interface SubmissionWindow {
  /** Submitting after this is "late" (still allowed until closesAt). */
  strictDeadline: Date;
  /** Submitting is blocked after this. */
  closesAt: Date;
}

export function submissionWindow(
  invite: { selectedPostDate?: unknown; paymentConfirmedAt?: unknown; submissionDeadlineExtendedTo?: unknown },
  postingDeadlineMode?: string,
): SubmissionWindow | null {
  const postDate = toTime(invite?.selectedPostDate);
  if (postDate === null) return null;
  const postStrict = postDate + 24 * HOUR_MS;
  const postCloses = postingDeadlineMode === 'strict' ? postStrict : postStrict + 24 * HOUR_MS;
  const paidAt = toTime(invite?.paymentConfirmedAt);
  const paidCloses = paidAt === null ? null : paidAt + SUBMIT_HOURS_AFTER_PAYMENT * HOUR_MS;
  const strictDeadline = Math.max(postStrict, paidCloses ?? postStrict);
  let closesAt = Math.max(postCloses, paidCloses ?? postCloses);
  const extendedTo = toTime(invite?.submissionDeadlineExtendedTo);
  if (extendedTo !== null) closesAt = Math.max(closesAt, extendedTo);
  return { strictDeadline: new Date(strictDeadline), closesAt: new Date(closesAt) };
}
