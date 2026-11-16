/**
 * WhatsApp text for a brand's creator shortlist (2026-11-16). Plain text only:
 * WhatsApp shows links and line breaks as they are.
 */

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function creatorLine(c: any, index: number, site: string): string {
  const account = (c.accounts || [])[0];
  const parts = [
    account ? `${account.platform} @${account.handle}${account.tier ? ` (${account.tier}${account.verified ? ', tier verified' : ''})` : ''}` : '',
    c.rate ? `${c.rate.name} ${rupees(c.rate.price)}` : '',
  ].filter(Boolean);
  const where = c.city ? `, ${c.city}` : '';
  const base = String(site || '').replace(/\/$/, '');
  const link = c.username ? `${base}/influencer/${encodeURIComponent(c.username)}` : '';
  return [`${index + 1}. ${c.name}${where}`, parts.length ? `   ${parts.join(' · ')}` : '', link ? `   ${link}` : '']
    .filter(Boolean)
    .join('\n');
}

export function shortlistMessage(request: any, creators: any[], site: string, signupLink: string): string {
  const where = [request.city, request.state].filter(Boolean).join(', ');
  const lines = [
    `Hi ${request.name}, this is TrendStarZ. Here ${creators.length === 1 ? 'is 1 creator' : `are ${creators.length} creators`} for ${request.businessName}${where ? ` near ${where}` : ''}:`,
    '',
    ...creators.map((c, i) => creatorLine(c, i, site)),
    '',
    signupLink
      ? `To invite them, create your free brand account (2 minutes, your details are already filled in):\n${signupLink}`
      : 'To invite them, create your free brand account on trendstarz.in.',
    'You pay only for creators who accept.',
  ];
  return lines.join('\n');
}

export function signupMessage(request: any, link: string): string {
  return `Hi ${request.name}, here is your TrendStarZ brand signup link. Your details are already filled in, so it takes about 2 minutes:\n${link}`;
}
