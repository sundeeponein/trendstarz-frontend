/**
 * Product campaigns that ship — display side of the server's
 * campaigns/product-timeline.util (2026-11-11). The server stores the dates on
 * the campaign (productTimeline, acceptanceDeadline, shipByDate,
 * earliestPostDate); screens read those. The form preview recomputes them from
 * the admin settings with the same rules.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export const PRODUCT_TIMELINE_DEFAULTS = {
  acceptDays: 2,
  shipByDays: 2,
  shippingDays: 5,
  postAfterDays: 7,
  releaseAfterShipByDays: 3,
  capDays: 15,
};

export type ProductTimelineNumbers = typeof PRODUCT_TIMELINE_DEFAULTS;

function positive(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export function productTimelineNumbers(settings: any): ProductTimelineNumbers {
  const d = PRODUCT_TIMELINE_DEFAULTS;
  return {
    ...d,
    acceptDays: positive(settings?.productAcceptanceDays, d.acceptDays),
    shipByDays: positive(settings?.productShipByDays, d.shipByDays),
    shippingDays: positive(settings?.productShippingDays, d.shippingDays),
    postAfterDays: positive(settings?.postAfterDeliveryDays, d.postAfterDays),
    capDays: positive(settings?.maxCampaignDurationDays, d.capDays),
  };
}

/** India calendar day as midnight UTC (how start/end/post dates are stored). */
export function istDay(value: Date | string | number): number {
  const shifted = new Date(new Date(value).getTime() + IST_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/** "2026-11-18" for a stored date (the India calendar day). */
export function ymd(value: Date | string | number | null | undefined): string {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(istDay(t)).toISOString().slice(0, 10);
}

export function hasProductTimeline(campaign: any): boolean {
  return campaign?.productTimeline === true && !!campaign?.shipByDate;
}

/** Form preview: the dates a product campaign starting on `start` will get. */
export function previewProductTimeline(start: string | Date, n: ProductTimelineNumbers) {
  const startDay = istDay(start);
  const acceptBy = startDay + n.acceptDays * DAY_MS;
  return {
    acceptBy: new Date(acceptBy),
    shipBy: new Date(acceptBy + n.shipByDays * DAY_MS),
    earliestPost: new Date(acceptBy + n.shippingDays * DAY_MS),
    minDays: n.acceptDays + n.shippingDays + 1,
  };
}

/** When a creator may leave without penalty if nothing was shipped (start of ship-by day + N, India). */
export function releaseAvailableAt(shipByDate: Date | string, days = PRODUCT_TIMELINE_DEFAULTS.releaseAfterShipByDays): Date {
  return new Date(istDay(shipByDate) + days * DAY_MS - IST_OFFSET_MS);
}

export const DELIVERY_OUTCOME_LABELS: Record<string, string> = {
  on_time: 'Received on time',
  late: 'Received late',
  not_received: 'Not received',
  host_not_shipped: 'Host failed to ship',
};
