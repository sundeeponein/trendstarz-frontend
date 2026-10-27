// Link previews for shared profile links (Vercel Routing Middleware).
//
// The site is a static Angular app, so every page starts with the same generic
// title and banner. When a preview bot (WhatsApp, Facebook/Instagram, X,
// LinkedIn…) opens /influencer/…, /photographer/… or /brand/…, this answers
// with a tiny page carrying that profile's name, photo and city instead.
// People (and Google, which runs the app) get the normal site untouched.
//
// The profile data comes from the backend's share-preview endpoint, which
// answers only for profiles a logged-out visitor could find — Private,
// Members-only, unapproved, deleted and flagged profiles fall back to the
// generic preview.
import { next } from '@vercel/functions';

export const config = {
  matcher: ['/influencer/:slug', '/photographer/:slug', '/brand/:slug'],
};

const API = 'https://api.trendstarz.in/api';

const PREVIEW_BOTS =
  /facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|skypeuripreview|redditbot|snapchat|viber|embedly|iframely/i;

export function isPreviewBot(userAgent: string | null): boolean {
  return PREVIEW_BOTS.test(userAgent || '');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Preview {
  title: string;
  description: string;
  image: string;
  url: string;
}

export function previewHtml(p: Preview): string {
  const t = escapeHtml(p.title);
  const d = escapeHtml(p.description);
  const u = escapeHtml(p.url);
  const img = p.image ? escapeHtml(p.image) : 'https://trendstarz.in/assets/public-banner.png';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="TrendStarz">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="${p.image ? 'summary' : 'summary_large_image'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
</head><body><h1>${t}</h1><p>${d}</p><p><a href="${u}">${u}</a></p></body></html>`;
}

export default async function middleware(request: Request) {
  if (!isPreviewBot(request.headers.get('user-agent'))) return next();
  const [, kind, slug] = new URL(request.url).pathname.split('/');
  try {
    const res = await fetch(`${API}/share-preview/${kind}/${encodeURIComponent(decodeURIComponent(slug || ''))}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return next();
    const body: any = await res.json();
    const p: Preview | undefined = body?.data ?? body; // the API wraps responses without `success`
    if (!p?.title || !p?.url) return next();
    return new Response(previewHtml(p), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=600, s-maxage=600',
        'x-robots-tag': 'noindex',
      },
    });
  } catch {
    return next(); // backend slow or down: the generic preview still works
  }
}
