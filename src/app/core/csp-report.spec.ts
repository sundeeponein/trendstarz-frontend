import { describeCspViolation } from './client-error-handler';

describe('security-policy reports', () => {
  it('names the rule and only the origin of what would be blocked', () => {
    expect(
      describeCspViolation({
        effectiveDirective: 'connect-src',
        blockedURI: 'https://new-tag.example.com/collect?uid=123&email=a@b.c',
        disposition: 'report',
      }),
    ).toBe('connect-src would block https://new-tag.example.com');
  });

  it('says blocked when the policy is enforced, and keeps inline/eval as is', () => {
    expect(describeCspViolation({ effectiveDirective: 'script-src-elem', blockedURI: 'inline', disposition: 'enforce' })).toBe(
      'script-src-elem blocked inline',
    );
  });
});
