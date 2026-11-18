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

  const source = qSource || referrerSource || 'direct';
  const audience = qAudience || undefined;
  const campaign = qCampaign || undefined;
  const content = qContent || undefined;

  return {
    source,
    audience,
    campaign,
    content,
    referrerPath: currentPath || undefined,
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
