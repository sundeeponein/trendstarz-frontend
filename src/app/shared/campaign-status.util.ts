import { ACCEPTED_OR_LATER, ACCEPTED_THROUGH_SUBMITTED, FINISHED_OR_DISPUTED } from './invite-status';
export type CampaignStatusTab = 'active' | 'pending' | 'completed' | 'draft' | 'needs_changes';

export function resolveCampaignStatusTab(
  status: string | null | undefined,
  inviteStatuses: string[] = [],
  isExpired = false,
): CampaignStatusTab {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const normalizedInviteStatuses = inviteStatuses.map((inviteStatus) =>
    String(inviteStatus || '').trim().toLowerCase(),
  );
  const hasStartedWork = normalizedInviteStatuses.some((inviteStatus) =>
    ACCEPTED_OR_LATER.includes(inviteStatus),
  );
  const hasCompletedWork = normalizedInviteStatuses.some((inviteStatus) =>
    FINISHED_OR_DISPUTED.includes(inviteStatus),
  );

  // Creators still accepted/working/under review: the campaign is not done.
  const hasOpenWork = normalizedInviteStatuses.some((inviteStatus) =>
    ACCEPTED_THROUGH_SUBMITTED.includes(inviteStatus),
  );

  if (normalizedStatus === 'completed' || normalizedStatus === 'cancelled') return 'completed';
  // A live campaign stays Active while anyone still has work open (e.g. 1 finished,
  // 2 working). It moves to Completed early only once every creator's work is done
  // and the end date has passed — the backend then closes it within the hour anyway.
  if (normalizedStatus === 'active') {
    return hasCompletedWork && !hasOpenWork && isExpired ? 'completed' : 'active';
  }
  if (normalizedStatus === 'pending' || normalizedStatus === 'pending_review') {
    return hasStartedWork ? 'active' : 'pending';
  }
  // Sent back by admin: its own tab so the host doesn't mistake it for a plain draft.
  if (normalizedStatus === 'needs_changes') {
    return hasStartedWork || isExpired ? 'completed' : 'needs_changes';
  }
  if (normalizedStatus === 'rejected' || normalizedStatus === 'draft') {
    if (hasStartedWork || isExpired) return 'completed';
  }
  return 'draft';
}
