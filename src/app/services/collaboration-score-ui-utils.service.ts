import { Injectable } from '@angular/core';
import { CollaborationAudit } from './collaboration-score-api.service';

// Badge/label formatting only — mirrors AdminPaymentsUiUtilsService's
// bg-*-subtle/text-*-emphasis convention. Vocabulary is deliberately never
// "Premium" for a score tier — that word is reserved for subscription
// status only.
@Injectable({ providedIn: 'root' })
export class CollaborationScoreUiUtilsService {
  // Single source of truth for the score-tier label/badge shown everywhere
  // (creator's own card, Score Center, search cards, admin detail) — must
  // stay in sync with the tier copy on the /trendstarz-score marketing page.
  // These are fixed, cosmetic display bands; they're deliberately separate
  // from audit.trendstarzRecommended/campaignReadiness, which are computed
  // from admin-configurable thresholds and shown as their own fields.
  scoreTierLabel(score: number): string {
    if (score >= 90) return 'TrendStarZ Recommended ⭐';
    if (score >= 75) return 'Campaign Ready';
    if (score >= 50) return 'Growing';
    return 'Needs Improvement';
  }

  scoreTierClass(score: number): string {
    if (score >= 90) return 'bg-success-subtle text-success-emphasis';
    if (score >= 75) return 'bg-primary-subtle text-primary-emphasis';
    if (score >= 50) return 'bg-warning-subtle text-warning-emphasis';
    return 'bg-danger-subtle text-danger-emphasis';
  }

  campaignReadinessClass(readiness: CollaborationAudit['campaignReadiness']): string {
    if (readiness === 'Campaign Ready') return 'bg-success-subtle text-success-emphasis';
    if (readiness === 'Partially Ready') return 'bg-warning-subtle text-warning-emphasis';
    return 'bg-danger-subtle text-danger-emphasis';
  }

  formatPricing(audit: Pick<CollaborationAudit, 'pricingSuggestion'>): string {
    const p = audit?.pricingSuggestion;
    if (!p || p.reelPrice == null) return 'Not available yet';
    return `₹${p.reelPrice.toLocaleString('en-IN')} / Reel`;
  }
}
