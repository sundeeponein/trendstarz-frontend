/**
 * Shared invite-status groups — use these instead of writing the lists inline,
 * so every screen agrees on what e.g. "finished" or "paid" means.
 *
 * Invite lifecycle (backend campaign-invites):
 *   pending/invited → counter_sent → accepted → payment_confirmed → working
 *   → submitted → approved (post approved, payout released) | completed
 *   Side exits: declined, withdrawn, disputed (host reported an issue).
 *
 * Membership lists only (order carries no meaning) — use with `.includes()`.
 */
type StatusList = readonly string[];

/** Accepted and still going or done: everything from acceptance on, disputes included. */
export const ACCEPTED_OR_LATER: StatusList = [
  'accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed',
];

/** Accepted or later, excluding disputed. */
export const ACCEPTED_NOT_DISPUTED: StatusList = [
  'accepted', 'payment_confirmed', 'working', 'submitted', 'completed', 'approved',
];

/** Accepted up to submission (not yet reviewed). */
export const ACCEPTED_THROUGH_SUBMITTED: StatusList = [
  'accepted', 'payment_confirmed', 'working', 'submitted',
];

/** Accepted but not submitted yet — the creator still has work to do. */
export const OPEN_WORK: StatusList = ['accepted', 'payment_confirmed', 'working'];

/** Payment confirmed and later, disputes included. */
export const PAID_OR_LATER: StatusList = [
  'payment_confirmed', 'working', 'submitted', 'completed', 'approved', 'disputed',
];

/** Payment confirmed and later, excluding disputed (e.g. when a creator may review the host). */
export const PAID_NOT_DISPUTED: StatusList = [
  'payment_confirmed', 'working', 'submitted', 'completed', 'approved',
];

/** The post was submitted (under review, finished or disputed). */
export const SUBMITTED_OR_LATER: StatusList = ['submitted', 'completed', 'approved', 'disputed'];

/** Finished work, or work that ended in a dispute. */
export const FINISHED_OR_DISPUTED: StatusList = ['completed', 'approved', 'disputed'];

/** Finished work: post approved (payout released) or completed. */
export const FINISHED: StatusList = ['completed', 'approved'];

/**
 * Closed because the creator accepted but never posted (or didn't turn up for a
 * location visit). Mirrors the backend's no-show rule (campaigns/creator-monthly-slots.util.ts);
 * unlike that rule, an admin-excused no-show still counts here — it still didn't post.
 */
const NO_SHOW_REASON_CODES = ['expired_unsubmitted', 'location_no_show'];
const LEGACY_NO_SHOW_REASONS = [
  'Posting deadline and grace period expired with no submission.',
  "Campaign's grace period ended with no submission.",
  'Campaign ended by host before submission.',
];
export function isNoShowInvite(invite: any): boolean {
  if (String(invite?.status || '') !== 'withdrawn') return false;
  const code = String(invite?.withdrawnReasonCode || '');
  if (code) return NO_SHOW_REASON_CODES.includes(code);
  return LEGACY_NO_SHOW_REASONS.includes(String(invite?.withdrawnReason || ''));
}
