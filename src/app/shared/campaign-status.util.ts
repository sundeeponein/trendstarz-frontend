export type CampaignStatusTab = 'active' | 'pending' | 'completed' | 'draft';

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
    ['accepted', 'payment_confirmed', 'working', 'submitted', 'approved', 'completed', 'disputed'].includes(inviteStatus),
  );
  const hasCompletedWork = normalizedInviteStatuses.some((inviteStatus) =>
    ['completed', 'approved', 'disputed'].includes(inviteStatus),
  );

  if (normalizedStatus === 'completed' || hasCompletedWork) return 'completed';
  if (normalizedStatus === 'active') return 'active';
  if (normalizedStatus === 'pending' || normalizedStatus === 'pending_review') {
    return hasStartedWork ? 'active' : 'pending';
  }
  if (normalizedStatus === 'rejected' || normalizedStatus === 'needs_changes' || normalizedStatus === 'draft') {
    if (hasStartedWork || isExpired) return 'completed';
  }
  return 'draft';
}
