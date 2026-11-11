import { ParamMap } from '@angular/router';

const SITE = 'https://trendstarz.in';

/**
 * A link that opens the creator's own profile on the Social Media step, ready
 * to edit. Signed out, the login guard sends them to log in first and then
 * straight back here (returnUrl), so one tap works either way.
 */
export function socialEditLink(role: string): string {
  const page = role === 'photographer' ? '/photographer-profile' : role === 'brand' ? '/brand-profile' : '/influencer-profile';
  // Brand profiles have no Social Media step to open.
  return role === 'brand' ? `${SITE}${page}` : `${SITE}${page}?edit=social`;
}

/** The profile page was opened from such a link. */
export function wantsSocialEdit(params: ParamMap): boolean {
  return params.get('edit') === 'social';
}
