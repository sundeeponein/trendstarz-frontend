import { submissionWindow } from './campaign-deadlines.util';

/** Same cases as the backend spec (campaign-deadlines.util.spec.ts) — the two must agree. */
describe('submissionWindow (mirrors the backend)', () => {
  const POST = '2026-10-07T00:00:00.000Z';
  const iso = (d: Date | undefined) => d?.toISOString();

  it('no post date → no deadline', () => {
    expect(submissionWindow({ paymentConfirmedAt: POST })).toBeNull();
  });

  it('grace mode: late after post date + 24h, closed after + 48h', () => {
    const w = submissionWindow({ selectedPostDate: POST, paymentConfirmedAt: '2026-09-30T12:00:00.000Z' }, 'grace_24h')!;
    expect(iso(w.strictDeadline)).toBe('2026-10-08T00:00:00.000Z');
    expect(iso(w.closesAt)).toBe('2026-10-09T00:00:00.000Z');
  });

  it('strict mode: closes at post date + 24h', () => {
    expect(iso(submissionWindow({ selectedPostDate: POST }, 'strict')!.closesAt)).toBe('2026-10-08T00:00:00.000Z');
  });

  it('paid on the last day with an earlier post date: 48h from payment, not late', () => {
    const w = submissionWindow(
      { selectedPostDate: '2026-10-04T00:00:00.000Z', paymentConfirmedAt: '2026-10-06T15:00:00.000Z' },
      'strict',
    )!;
    expect(iso(w.closesAt)).toBe('2026-10-08T15:00:00.000Z');
    expect(iso(w.strictDeadline)).toBe('2026-10-08T15:00:00.000Z');
  });

  it('an admin extension only lengthens the window', () => {
    expect(
      iso(submissionWindow({ selectedPostDate: POST, submissionDeadlineExtendedTo: '2026-10-12T10:00:00.000Z' })!.closesAt),
    ).toBe('2026-10-12T10:00:00.000Z');
    expect(
      iso(submissionWindow({ selectedPostDate: POST, submissionDeadlineExtendedTo: '2026-10-07T10:00:00.000Z' })!.closesAt),
    ).toBe('2026-10-09T00:00:00.000Z');
  });
});
