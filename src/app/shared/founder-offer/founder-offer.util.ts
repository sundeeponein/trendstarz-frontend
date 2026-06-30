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

/** Builds the per-cycle options shown in the Founder Launch Offer, from the same admin-configured Plan data used everywhere else (price + discount + bonusMonths). Carries discount and bonus separately so the popup can describe whichever (or both) actually apply — a plan with a price discount but 0 bonus months should never claim "pay 1, get 1". */
export function buildFounderOfferOptions(plan: Plan | undefined): FounderOfferOption[] {
  if (!plan) return [];
  const discountMonthly = offerValue(plan, 'discountMonthly');
  const discountQuarterly = offerValue(plan, 'discountQuarterly');
  const bonusMonthly = offerValue(plan, 'bonusMonthsMonthly');
  const bonusQuarterly = offerValue(plan, 'bonusMonthsQuarterly');

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
  const hasBonus = offerValue(plan, 'bonusMonthsMonthly') > 0 || offerValue(plan, 'bonusMonthsQuarterly') > 0;
  return hasDiscount || hasBonus;
}
