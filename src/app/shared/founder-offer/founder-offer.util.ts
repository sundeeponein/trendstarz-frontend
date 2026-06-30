import { Plan } from '../plans.service';

export interface FounderOfferOption {
  cycleLabel: string;
  baseMonths: number;
  bonusMonths: number;
  totalMonths: number;
  originalPrice: number;
  price: number;
  discountPercent: number;
  recommended: boolean;
}

function offerValue(plan: Plan | undefined, key: string): number {
  if (!plan || !Array.isArray(plan.offers)) return 0;
  const found = plan.offers.find((o) => o.key === key);
  return found ? Number(found.value) || 0 : 0;
}

/** Builds the per-cycle options shown in the Founder Launch Offer, from the same admin-configured Plan data used everywhere else (price + discount + bonusMonths). Carries discount and bonus separately so the popup can describe whichever (or both) actually apply — a plan with a price discount but 0 bonus months should never claim "pay 1, get 1". Bonus months shown here are the standing Pricing & Discounts bonus PLUS the Founder Offer popup's own bonus, stacked — matching what the backend actually grants on approval for an eligible user. */
export function buildFounderOfferOptions(plan: Plan | undefined): FounderOfferOption[] {
  if (!plan) return [];
  const discountMonthly = offerValue(plan, 'discountMonthly');
  const discountQuarterly = offerValue(plan, 'discountQuarterly');
  const bonusMonthly = offerValue(plan, 'bonusMonthsMonthly') + offerValue(plan, 'founderBonusMonthsMonthly');
  const bonusQuarterly = offerValue(plan, 'bonusMonthsQuarterly') + offerValue(plan, 'founderBonusMonthsQuarterly');

  const monthlyOriginal = plan.price?.monthly || 0;
  const quarterlyOriginal = plan.price?.quarterly || 0;
  const monthlyPrice = Math.round(monthlyOriginal * (1 - discountMonthly / 100));
  const quarterlyPrice = Math.round(quarterlyOriginal * (1 - discountQuarterly / 100));

  const options: FounderOfferOption[] = [];
  if (monthlyPrice > 0) {
    options.push({
      cycleLabel: 'Monthly',
      baseMonths: 1,
      bonusMonths: bonusMonthly,
      totalMonths: 1 + bonusMonthly,
      originalPrice: monthlyOriginal,
      price: monthlyPrice,
      discountPercent: discountMonthly,
      recommended: false,
    });
  }
  if (quarterlyPrice > 0) {
    options.push({
      cycleLabel: 'Quarterly',
      baseMonths: 3,
      bonusMonths: bonusQuarterly,
      totalMonths: 3 + bonusQuarterly,
      originalPrice: quarterlyOriginal,
      price: quarterlyPrice,
      discountPercent: discountQuarterly,
      recommended: true,
    });
  }
  return options;
}

/** True only when there's an actual discount or bonus-months deal configured — never show the offer framing for a plain, undiscounted plan. */
export function hasRealFounderOffer(plan: Plan | undefined): boolean {
  if (!plan) return false;
  if ((plan.price?.monthly || 0) <= 0 && (plan.price?.quarterly || 0) <= 0) return false;
  const hasDiscount = offerValue(plan, 'discountMonthly') > 0 || offerValue(plan, 'discountQuarterly') > 0;
  const hasBonus =
    offerValue(plan, 'bonusMonthsMonthly') > 0 ||
    offerValue(plan, 'bonusMonthsQuarterly') > 0 ||
    offerValue(plan, 'founderBonusMonthsMonthly') > 0 ||
    offerValue(plan, 'founderBonusMonthsQuarterly') > 0;
  return hasDiscount || hasBonus;
}

/** "New" = registered within the offer window (days) of right now. There's no separate launch-date setting — the same Offer Window number doubles as the new/existing cutoff, since both describe "how recently must you have joined to count as part of this launch." Unknown registration date is treated as new (safest default — never silently hides an offer). */
export function isNewUserForFounderOffer(registeredAt: string | Date | null | undefined, windowDays: number): boolean {
  if (!registeredAt) return true;
  const start = new Date(registeredAt).getTime();
  if (!Number.isFinite(start)) return true;
  const elapsedDays = (Date.now() - start) / (1000 * 60 * 60 * 24);
  return elapsedDays <= windowDays;
}

/** Whether the popup should be shown to this user at all, combining the offer's audience checkboxes with their new/existing status. */
export function matchesFounderOfferAudience(plan: Plan | undefined, registeredAt: string | Date | null | undefined): boolean {
  if (!plan) return false;
  const isNew = isNewUserForFounderOffer(registeredAt, plan.founderOfferWindowDays || 7);
  return isNew ? (plan.founderOfferForNewUsers ?? true) : (plan.founderOfferForExistingUsers ?? true);
}
