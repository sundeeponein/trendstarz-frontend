const CREATOR_DASHBOARDS = ['/influencer-dashboard', '/photographer-dashboard'];

/**
 * Same rule as the server (backend utils/notification-target.util.ts), for
 * notifications saved before it existed: a bare creator-dashboard link opens
 * the part the notification is about.
 */
export function creatorNotificationUrl(url: unknown, title: unknown, body?: unknown): string {
  const link = String(url ?? '');
  if (!CREATOR_DASHBOARDS.includes(link)) return link;
  const text = `${String(title ?? '')} ${String(body ?? '')}`.toLowerCase();
  if (/payout|payment|paid|refund|₹|earning|credit/.test(text)) return `${link}?section=payments`;
  if (/invite|offer|counter|collaboration request/.test(text)) return `${link}?section=invites`;
  if (/post|submission|submitted|approved|review|dispute|campaign|deadline|participation|shipping|product|visit/.test(text)) {
    return '/campaigns?tab=campaigns';
  }
  return link;
}
