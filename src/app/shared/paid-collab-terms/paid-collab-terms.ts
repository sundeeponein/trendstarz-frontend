/**
 * Paid-collaboration terms (mirror of the backend's campaigns/paid-collab-terms.ts).
 * DRAFT for review — to be checked for enforceability in India before it is binding.
 */
export const PAID_COLLAB_TERMS = [
  "Once the host's payment is confirmed, only TrendStarZ can cancel this collaboration.",
  "If the creator does not submit a post by the deadline, the host's payment is held for 7 days and reviewed before any refund.",
  'For 12 months from the date contact details were first shared through TrendStarZ, paid work between the same host and creator must be arranged through TrendStarZ.',
  'Asking the other side to skip posting, cancel, or deal outside TrendStarZ can be reported. If TrendStarZ confirms it, TrendStarZ may charge its fee and review or suspend the accounts involved.',
];

/** Added in terms v2 — shown only once the admin-set effective date is reached. */
export const PAID_COLLAB_TERMS_V2_ADDITIONS = [
  "A paid invite stays counted in the campaign's invite limit even if the collaboration closes or is refunded.",
  "If the creator does not post, the creator's agreed amount is refunded by UPI and the platform fee is returned as TrendStarZ credit, valid for 12 months and usable only for future TrendStarZ platform fees.",
];

export const OFFPLATFORM_REPORT_LABEL = 'Asked to skip posting / deal outside TrendStarZ';
