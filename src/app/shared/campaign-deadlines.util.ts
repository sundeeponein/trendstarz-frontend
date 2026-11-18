/**
 * Creator submission window — mirrors the backend's submissionWindow
 * (trendstarz-backend src/campaigns/campaign-deadlines.util.ts) exactly:
 * post date + 24h (+24h grace unless "strict"), never less than the admin grace
 * period (settings.campaignAutoCloseGraceHours; 0/empty = none) after the payment
 * was confirmed, and never before an admin extension.
 */
const HOUR_MS = 60 * 60 * 1000;
/** Admin grace setting when it was never saved (same default as the settings page). */
export const DEFAULT_GRACE_HOURS = 24;

/** The admin grace period in hours from app settings; 0 when set to 0/empty. */
export function graceHoursFromSettings(settings: any): number {
  const raw = settings?.campaignAutoCloseGraceHours;
  if (raw === undefined) return DEFAULT_GRACE_HOURS;
  const hours = Number(raw ?? 0);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

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
  /** Admin grace hours: the minimum time to submit after payment (0 = none). */
  paidGraceHours = 0,
): SubmissionWindow | null {
  const postDate = toTime(invite?.selectedPostDate);
  if (postDate === null) return null;
  const postStrict = postDate + 24 * HOUR_MS;
  const postCloses = postingDeadlineMode === 'strict' ? postStrict : postStrict + 24 * HOUR_MS;
  const paidAt = toTime(invite?.paymentConfirmedAt);
  const paidCloses = paidAt === null || !(paidGraceHours > 0) ? null : paidAt + paidGraceHours * HOUR_MS;
  const strictDeadline = Math.max(postStrict, paidCloses ?? postStrict);
  let closesAt = Math.max(postCloses, paidCloses ?? postCloses);
  const extendedTo = toTime(invite?.submissionDeadlineExtendedTo);
  if (extendedTo !== null) closesAt = Math.max(closesAt, extendedTo);
  return { strictDeadline: new Date(strictDeadline), closesAt: new Date(closesAt) };
}
