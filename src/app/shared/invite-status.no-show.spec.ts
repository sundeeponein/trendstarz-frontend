import { isNoShowInvite } from './invite-status';

describe('isNoShowInvite — accepted, then closed without a post', () => {
  it('matches the no-show closure codes (and older closure texts), not real declines', () => {
    expect(isNoShowInvite({ status: 'withdrawn', withdrawnReasonCode: 'expired_unsubmitted' })).toBeTrue();
    expect(isNoShowInvite({ status: 'withdrawn', withdrawnReasonCode: 'location_no_show' })).toBeTrue();
    expect(
      isNoShowInvite({ status: 'withdrawn', withdrawnReason: 'Posting deadline and grace period expired with no submission.' }),
    ).toBeTrue();
    expect(isNoShowInvite({ status: 'withdrawn', withdrawnReasonCode: 'host_cancelled' })).toBeFalse();
    expect(isNoShowInvite({ status: 'declined' })).toBeFalse();
    // Excused by an admin: the slot comes back, but the host still sees they didn't post.
    expect(
      isNoShowInvite({ status: 'withdrawn', withdrawnReasonCode: 'expired_unsubmitted', missExcused: { at: new Date() } }),
    ).toBeTrue();
  });
});
