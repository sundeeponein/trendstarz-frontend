export interface SignupAttribution {
  source?: string;
  audience?: string;
  campaign?: string;
  content?: string;
  referrerPath?: string;
  referrerUrl?: string;
}

/**
 * Maps a referrer hostname to a human-readable source label.
 * Returns undefined when the referrer is same-origin or unrecognised.
 */
function sourceFromReferrer(referrer: string): string | undefined {
  if (!referrer) return undefined;
  let hostname = '';
  try {
    hostname = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }

  if (hostname === 'instagram.com' || hostname === 'l.instagram.com') return 'instagram';
  if (hostname === 'web.whatsapp.com' || hostname === 'wa.me' || hostname === 'api.whatsapp.com' || hostname.includes('whatsapp')) return 'whatsapp';
  if (hostname === 'facebook.com' || hostname === 'm.facebook.com' || hostname === 'fb.com' || hostname === 'lm.facebook.com') return 'facebook';
  if (
    hostname.startsWith('mail.') ||
    hostname === 'mail.google.com' ||
    hostname === 'outlook.live.com' ||
    hostname === 'outlook.office.com' ||
    hostname === 'mail.yahoo.com' ||
    hostname.includes('webmail')
  ) return 'email';
  if (hostname === 'twitter.com' || hostname === 't.co' || hostname === 'x.com') return 'twitter';
  if (hostname === 'linkedin.com' || hostname === 'lnkd.in') return 'linkedin';
  if (hostname === 'youtube.com' || hostname === 'youtu.be') return 'youtube';
  if (hostname === 'google.com' || hostname.startsWith('google.')) return 'google';

  return undefined;
}

// ── First visit (2026-11-16) ──
// Most signups came through as "direct": the tag was on the link someone first
// opened (home page, a campaign), but signup reads only the registration page's
// own URL, and WhatsApp / Instagram in-app browsers send no referrer. The first
// tagged visit is remembered for 60 days and used when signup has nothing better.

const FIRST_TOUCH_KEY = 'tsz_first_touch';
const FIRST_TOUCH_DAYS = 60;

interface FirstTouch extends SignupAttribution {
  at: number;
}

/** Call once at startup with the landing URL's query string. Keeps the first tagged visit only. */
export function rememberFirstTouch(search: string, win?: Window & typeof globalThis): void {
  try {
    if (!win?.localStorage) return;
    let params = new URLSearchParams(search || '');
    const returnUrl = params.get('returnUrl') || '';
    if (!params.get('utm_source') && !params.get('source') && !params.get('ref') && returnUrl.includes('?')) {
      params = new URLSearchParams(returnUrl.slice(returnUrl.indexOf('?')));
    }
    const clip = (v: string | null) => (v || '').trim().slice(0, 80);
    const source = clip(params.get('utm_source') || params.get('source') || params.get('ref')).toLowerCase() ||
      sourceFromReferrer(win.document?.referrer || '') || '';
    if (!source) return;
    if (readFirstTouch(win)) return;
    const touch: FirstTouch = {
      source,
      audience: clip(params.get('utm_medium') || params.get('audience')) || undefined,
      campaign: clip(params.get('utm_campaign')) || undefined,
      content: clip(params.get('utm_content')) || undefined,
      referrerPath: win.location?.pathname || undefined,
      at: Date.now(),
    };
    win.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch));
  } catch {
    // storage blocked: nothing to remember
  }
}

/** The remembered first tagged visit, if still within 60 days. */
export function readFirstTouch(win?: Window & typeof globalThis): FirstTouch | null {
  try {
    const raw = win?.localStorage?.getItem(FIRST_TOUCH_KEY);
    if (!raw) return null;
    const touch = JSON.parse(raw) as FirstTouch;
    if (!touch?.source || !Number.isFinite(touch.at) || Date.now() - touch.at > FIRST_TOUCH_DAYS * 864e5) return null;
    return touch;
  } catch {
    return null;
  }
}

/**
 * Reads signup attribution from URL query params (explicit) and falls back to
 * document.referrer detection. Call inside ngOnInit after ActivatedRoute is ready.
 *
 * @param queryParams - snapshot.queryParamMap
 * @param win - window object (pass window if in browser, undefined on server)
 */
export function captureSignupAttribution(
  queryParams: { get(key: string): string | null },
  win?: Window & typeof globalThis,
): SignupAttribution {
  // 1. Explicit URL params win over everything
  const qSource =
    queryParams.get('source') ||
    queryParams.get('utm_source') ||
    queryParams.get('ref') ||
    '';
  const qAudience =
    queryParams.get('audience') ||
    queryParams.get('utm_medium') ||
    '';
  const qCampaign = queryParams.get('utm_campaign') || '';
  const qContent = queryParams.get('utm_content') || '';

  const referrer = win?.document?.referrer || '';
  const referrerSource = sourceFromReferrer(referrer);
  const currentPath = win?.location?.pathname || '';

  // Nothing on this page: use the first tagged visit (e.g. a WhatsApp link to the home page).
  const first = !qSource && !referrerSource ? readFirstTouch(win) : null;
  const source = qSource || referrerSource || first?.source || 'direct';
  const audience = qAudience || (first ? first.audience : undefined) || undefined;
  const campaign = qCampaign || (first ? first.campaign : undefined) || undefined;
  const content = qContent || (first ? first.content : undefined) || undefined;

  return {
    source,
    audience,
    campaign,
    content,
    referrerPath: (first?.referrerPath || currentPath) || undefined,
    referrerUrl: referrer || undefined,
  };
}

/** Human-readable label for display in the admin table */
export function signupSourceLabel(source: string | undefined): string {
  const map: Record<string, string> = {
    instagram: 'Instagram',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    email: 'Email',
    twitter: 'Twitter / X',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    google: 'Google',
    direct: 'Direct Link',
  };
  if (!source) return '-';
  return map[source.toLowerCase()] ?? source;
}
