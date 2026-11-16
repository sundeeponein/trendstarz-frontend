import { captureSignupAttribution, readFirstTouch, rememberFirstTouch } from './signup-attribution.util';

describe('first tagged visit (2026-11-16)', () => {
  const fakeWin = (referrer = '', path = '/') => {
    const store = new Map<string, string>();
    return {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
      document: { referrer },
      location: { pathname: path, search: '' },
    } as any;
  };
  const params = (q: string) => new URLSearchParams(q);

  it('a later signup with no tag is credited to the first tagged visit', () => {
    const win = fakeWin('', '/campaigns');
    rememberFirstTouch('?utm_source=whatsapp&utm_medium=community&utm_campaign=CMP-12', win);
    const a = captureSignupAttribution(params(''), win);
    expect(a.source).toBe('whatsapp');
    expect(a.campaign).toBe('CMP-12');
    expect(a.referrerPath).toBe('/campaigns');
  });

  it('keeps the first visit, and a tag on the signup page itself still wins', () => {
    const win = fakeWin();
    rememberFirstTouch('?utm_source=instagram', win);
    rememberFirstTouch('?utm_source=facebook', win);
    expect(readFirstTouch(win)?.source).toBe('instagram');
    expect(captureSignupAttribution(params('utm_source=email'), win).source).toBe('email');
  });

  it('untagged visits are not remembered; tags inside returnUrl are', () => {
    const win = fakeWin();
    rememberFirstTouch('', win);
    expect(readFirstTouch(win)).toBeNull();
    expect(captureSignupAttribution(params(''), win).source).toBe('direct');
    rememberFirstTouch('?returnUrl=%2Fcampaigns%3Fopen%3Dx%26utm_source%3Dwhatsapp', win);
    expect(readFirstTouch(win)?.source).toBe('whatsapp');
  });
});
