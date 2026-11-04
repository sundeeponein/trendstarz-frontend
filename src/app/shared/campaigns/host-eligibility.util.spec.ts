import {
  HostEligibilityView,
  hostEligibilityBadge,
  hostEligibilityFor,
  passesHostEligibilityFilter,
} from './host-eligibility.util';

const view = (over: Partial<HostEligibilityView> = {}): HostEligibilityView => ({
  campaignId: 'camp-1',
  supported: true,
  configured: ['Category', 'Location'],
  creators: {
    a: { status: 'meets', notMet: [], needsInfo: [] },
    b: { status: 'not_met', notMet: ['Category', 'Location'], needsInfo: [] },
    c: { status: 'needs_info', notMet: [], needsInfo: ['Language'] },
  },
  ...over,
});

describe('host eligibility (Stage 3B-4)', () => {
  it('looks creators up by id or by a populated recipient object', () => {
    expect(hostEligibilityFor(view(), 'a')?.status).toBe('meets');
    expect(hostEligibilityFor(view(), { _id: 'b' })?.status).toBe('not_met');
    expect(hostEligibilityFor(view(), 'unknown-or-unapproved')).toBeNull();
    expect(hostEligibilityFor(view(), null)).toBeNull();
  });

  it('shows nothing when the view is missing or unsupported', () => {
    expect(hostEligibilityBadge(null, 'a')).toBeNull();
    expect(hostEligibilityBadge(view({ supported: false }), 'a')).toBeNull();
  });

  it('labels each status and explains the basis', () => {
    expect(hostEligibilityBadge(view(), 'a')).toEqual({
      status: 'meets',
      label: 'Meets requirements',
      title: "Checked against this campaign's requirements: Category, Location.",
    });
    expect(hostEligibilityBadge(view(), 'b')?.label).toBe("Doesn't match: Category, Location");
    const c = hostEligibilityBadge(view(), 'c')!;
    expect(c.label).toBe('Missing info: Language');
    expect(c.title).toContain("can't be checked");
  });

  it('the filter hides only non-meeting creators, and only when switched on', () => {
    for (const id of ['a', 'b', 'c', 'x'])
      expect(passesHostEligibilityFilter(view(), id, false)).toBeTrue();
    expect(
      ['a', 'b', 'c', 'x'].filter((id) => passesHostEligibilityFilter(view(), id, true)),
    ).toEqual(['a']);
    // No usable view → never hide anyone.
    expect(passesHostEligibilityFilter(null, 'b', true)).toBeTrue();
    expect(passesHostEligibilityFilter(view({ supported: false }), 'b', true)).toBeTrue();
  });
});
