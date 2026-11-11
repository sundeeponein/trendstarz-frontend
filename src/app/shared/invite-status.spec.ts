import {
  ACCEPTED_NOT_DISPUTED,
  ACCEPTED_OR_LATER,
  ACCEPTED_THROUGH_SUBMITTED,
  FINISHED,
  FINISHED_OR_DISPUTED,
  OPEN_WORK,
  PAID_NOT_DISPUTED,
  PAID_OR_LATER,
  SUBMITTED_OR_LATER,
} from './invite-status';

/** The groups are built from each other — these keep them consistent if one is edited. */
describe('invite-status groups', () => {
  const sorted = (xs: readonly string[]) => [...xs].sort();
  const plus = (xs: readonly string[], ...more: string[]) => sorted([...xs, ...more]);
  const minus = (xs: readonly string[], ...less: string[]) => sorted(xs.filter((x) => !less.includes(x)));

  it('accepted or later = accepted + paid or later', () => {
    expect(sorted(ACCEPTED_OR_LATER)).toEqual(plus(PAID_OR_LATER, 'accepted'));
  });

  it('the "not disputed" variants are the same lists without disputed', () => {
    expect(sorted(ACCEPTED_NOT_DISPUTED)).toEqual(minus(ACCEPTED_OR_LATER, 'disputed'));
    expect(sorted(PAID_NOT_DISPUTED)).toEqual(minus(PAID_OR_LATER, 'disputed'));
    expect(sorted(FINISHED)).toEqual(minus(FINISHED_OR_DISPUTED, 'disputed'));
  });

  it('open work + submitted = accepted through submitted; + finished or disputed = accepted or later', () => {
    expect(sorted(ACCEPTED_THROUGH_SUBMITTED)).toEqual(plus(OPEN_WORK, 'submitted'));
    expect(sorted(ACCEPTED_OR_LATER)).toEqual(sorted([...ACCEPTED_THROUGH_SUBMITTED, ...FINISHED_OR_DISPUTED]));
    expect(sorted(SUBMITTED_OR_LATER)).toEqual(plus(FINISHED_OR_DISPUTED, 'submitted'));
  });

  it('no duplicates and nothing pre-acceptance', () => {
    for (const list of [ACCEPTED_OR_LATER, PAID_OR_LATER, SUBMITTED_OR_LATER, FINISHED, OPEN_WORK]) {
      expect(new Set(list).size).toBe(list.length);
      for (const s of ['pending', 'invited', 'counter_sent', 'declined', 'withdrawn']) {
        expect(list).not.toContain(s);
      }
    }
  });
});
