import { confirmedAwaitingStartLabel } from './invite-status-labels.util';

describe('invite status labels', () => {
  it('names the confirmed-but-not-started state for each viewer', () => {
    expect(confirmedAwaitingStartLabel('host')).toBe('Awaiting Work Start');
    expect(confirmedAwaitingStartLabel('admin')).toBe('Payment Confirmed — Awaiting Start');
    expect(confirmedAwaitingStartLabel('creator')).toBe('Ready to start');
  });
});
