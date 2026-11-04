/**
 * Stage 3B-4 — campaign owner's view of creator eligibility
 * (GET campaigns/:id/creator-eligibility).
 *
 * Labels only: which of the campaign's requirements a creator meets. It never
 * blocks inviting or applying; it is a hint for the host.
 */
export interface HostCreatorEligibility {
  status: 'meets' | 'not_met' | 'needs_info';
  notMet: string[];
  needsInfo: string[];
}

export interface HostEligibilityView {
  campaignId: string;
  supported: boolean;
  configured: string[];
  creators: Record<string, HostCreatorEligibility>;
}

export interface HostEligibilityBadge {
  status: HostCreatorEligibility['status'];
  label: string;
  title: string;
}

/** The creator's eligibility, or null when there is nothing to show (unsupported, not loaded, not approved). */
export function hostEligibilityFor(
  view: HostEligibilityView | null | undefined,
  creatorId: unknown,
): HostCreatorEligibility | null {
  if (!view?.supported) return null;
  const id =
    typeof creatorId === 'string' ? creatorId : String((creatorId as any)?._id ?? creatorId ?? '');
  return (id && view.creators?.[id]) || null;
}

export function hostEligibilityBadge(
  view: HostEligibilityView | null | undefined,
  creatorId: unknown,
): HostEligibilityBadge | null {
  const e = hostEligibilityFor(view, creatorId);
  if (!e) return null;
  const basis = view?.configured?.length
    ? `Checked against this campaign's requirements: ${view.configured.join(', ')}.`
    : "Checked against this campaign's requirements.";
  if (e.status === 'meets') return { status: e.status, label: 'Meets requirements', title: basis };
  if (e.status === 'not_met')
    return { status: e.status, label: `Doesn't match: ${e.notMet.join(', ')}`, title: basis };
  return {
    status: e.status,
    label: `Missing info: ${e.needsInfo.join(', ')}`,
    title: `${basis} The creator's profile doesn't say, so it can't be checked.`,
  };
}

/** "Meets requirements only" filter. With no usable view, nothing is hidden. */
export function passesHostEligibilityFilter(
  view: HostEligibilityView | null | undefined,
  creatorId: unknown,
  meetsOnly: boolean,
): boolean {
  if (!meetsOnly || !view?.supported) return true;
  return hostEligibilityFor(view, creatorId)?.status === 'meets';
}
