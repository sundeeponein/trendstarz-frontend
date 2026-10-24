/**
 * One creator's invite situation on one campaign, from that campaign's invite
 * rows. Shared by the campaign form (step 3) and the campaign-management invite
 * drawer so both apply the same re-invite rule:
 *
 *   active     any invite still in play          → already invited, not selectable
 *   declined   (no active) the creator said no   → not re-invitable
 *   withdrawn  (no active, never declined) the
 *              invite was withdrawn/expired       → can be invited again
 *   null       never invited                     → selectable
 */
export type RecipientInviteState = 'active' | 'declined' | 'withdrawn' | null;

const INACTIVE = new Set(['declined', 'withdrawn']);

/** The recipient id an invite row points at (influencer or photographer, populated or not). */
export function inviteRecipientId(invite: any): string {
  return String(
    invite?.influencerId?._id ||
      invite?.influencerId ||
      invite?.photographerId?._id ||
      invite?.photographerId ||
      '',
  ).trim();
}

export function recipientInviteState(
  invites: any[] | null | undefined,
  recipientId: string,
): RecipientInviteState {
  const id = String(recipientId || '').trim();
  if (!id) return null;
  const mine = (Array.isArray(invites) ? invites : []).filter((i) => inviteRecipientId(i) === id);
  if (!mine.length) return null;
  const statuses = mine.map((i) => String(i?.status || '').toLowerCase());
  if (statuses.some((s) => !INACTIVE.has(s))) return 'active';
  if (statuses.includes('declined')) return 'declined';
  return 'withdrawn';
}

/** The invite that describes the recipient best: an active one first, else the most recent. */
export function primaryInviteFor(
  invites: any[] | null | undefined,
  recipientId: string,
): any | null {
  const id = String(recipientId || '').trim();
  const mine = (Array.isArray(invites) ? invites : []).filter((i) => inviteRecipientId(i) === id);
  if (!mine.length) return null;
  const active = mine.find((i) => !INACTIVE.has(String(i?.status || '').toLowerCase()));
  if (active) return active;
  return [...mine].sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
  )[0];
}

/** True when a new invite may be sent to this recipient (never invited, or only withdrawn invites). */
export function canReinvite(state: RecipientInviteState): boolean {
  return state === null || state === 'withdrawn';
}
