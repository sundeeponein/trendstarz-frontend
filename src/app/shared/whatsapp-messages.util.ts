/**
 * Single place for the plain-text WhatsApp messages admins/users copy and send
 * manually (via navigator.clipboard.writeText). Previously each of these was
 * built inline in its own component, which is exactly how the campaign-alert
 * messages drifted before they were consolidated (see campaign-alert-messages.ts
 * on the backend) — kept here so wording only ever needs editing in one place.
 */

export function paymentReleaseMessage(params: {
  amount: string;
  campaignName: string;
  payoutRefLabel: string;
  payoutRefValue: string;
}): string {
  return [
    `Your payment of ${params.amount} for the "${params.campaignName}" campaign has been released successfully.`,
    '',
    `${params.payoutRefLabel}: ${params.payoutRefValue}`,
    '',
    'Thank you for collaborating with TrendStarz!',
  ].join('\n');
}

export function payoutReleasedMessage(params: {
  campaignTitle: string;
  amount: string;
  payoutRefLabel: string;
  payoutRefValue: string;
  /** Pre-formatted, e.g. via toLocaleString — left as a display string so this stays a pure text builder. */
  paidOnLabel?: string;
}): string {
  const dateLine = params.paidOnLabel ? `\nPaid on: ${params.paidOnLabel}` : '';
  return [
    `Hi, your TrendStarZ payout for "${params.campaignTitle}" has been released.`,
    `Amount: ${params.amount}`,
    `${params.payoutRefLabel}: ${params.payoutRefValue}${dateLine}`,
    'Thank you for completing the campaign.',
  ].join('\n');
}

export function emailVerificationReminderMessage(params: {
  name: string;
  email: string;
}): string {
  return [
    `Hi ${params.name}, your TrendStarZ email (${params.email}) is still not verified.`,
    '',
    'Please check your inbox (and spam/promotions folder) for our verification email and tap the link inside to verify.',
    '',
    'If you can\'t find it, log in to TrendStarZ and tap "Resend verification email" to get a new link. It stays valid for 1 hour.',
    '',
    'Thank you for joining TrendStarZ!',
  ].join('\n');
}
