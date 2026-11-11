import {
  canReinvite,
  inviteRecipientId,
  primaryInviteFor,
  recipientInviteState,
} from './invite-state.util';

describe('invite-state.util (re-invite rule)', () => {
  const inv = (
    id: string,
    status: string,
    createdAt = '2026-10-01T00:00:00Z',
    photographer = false,
  ) =>
    photographer
      ? { photographerId: { _id: id }, status, createdAt }
      : { influencerId: id, status, createdAt };

  it('reads the recipient id from any invite shape', () => {
    expect(inviteRecipientId({ influencerId: 'a' })).toBe('a');
    expect(inviteRecipientId({ influencerId: { _id: 'b' } })).toBe('b');
    expect(inviteRecipientId({ photographerId: { _id: 'c' } })).toBe('c');
    expect(inviteRecipientId({})).toBe('');
  });

  it('never invited → null, can invite', () => {
    expect(recipientInviteState([inv('x', 'pending')], 'a')).toBeNull();
    expect(canReinvite(null)).toBeTrue();
  });

  it('any active invite wins → not selectable', () => {
    for (const s of [
      'pending',
      'accepted',
      'working',
      'submitted',
      'approved',
      'completed',
      'disputed',
    ]) {
      expect(recipientInviteState([inv('a', 'withdrawn'), inv('a', s)], 'a')).toBe('active');
    }
    expect(canReinvite('active')).toBeFalse();
  });

  it('declined (with no active invite) blocks re-inviting, even if another was withdrawn', () => {
    expect(recipientInviteState([inv('a', 'declined')], 'a')).toBe('declined');
    expect(recipientInviteState([inv('a', 'withdrawn'), inv('a', 'declined')], 'a')).toBe(
      'declined',
    );
    expect(canReinvite('declined')).toBeFalse();
  });

  it('only withdrawn invites → can be invited again', () => {
    expect(recipientInviteState([inv('a', 'withdrawn'), inv('a', 'WITHDRAWN')], 'a')).toBe(
      'withdrawn',
    );
    expect(canReinvite('withdrawn')).toBeTrue();
  });

  it('photographer invites are matched too', () => {
    expect(recipientInviteState([inv('p', 'withdrawn', undefined, true)], 'p')).toBe('withdrawn');
  });

  it('primary invite: the active one, else the newest', () => {
    const old = inv('a', 'withdrawn', '2026-09-01T00:00:00Z');
    const fresh = inv('a', 'pending', '2026-08-01T00:00:00Z');
    expect(primaryInviteFor([old, fresh], 'a')).toBe(fresh);
    const w1 = inv('a', 'withdrawn', '2026-09-01T00:00:00Z');
    const w2 = inv('a', 'withdrawn', '2026-09-20T00:00:00Z');
    expect(primaryInviteFor([w1, w2], 'a')).toBe(w2);
    expect(primaryInviteFor([], 'a')).toBeNull();
  });
});
