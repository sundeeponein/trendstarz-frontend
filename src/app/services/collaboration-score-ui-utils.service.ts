import { Injectable } from '@angular/core';
import { CollaborationAudit } from './collaboration-score-api.service';

// Badge/label formatting only — mirrors AdminPaymentsUiUtilsService's
// bg-*-subtle/text-*-emphasis convention. Vocabulary is deliberately never
// "Premium" for a score tier — that word is reserved for subscription
// status only.
@Injectable({ providedIn: 'root' })
export class CollaborationScoreUiUtilsService {
  scoreTierLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Just Getting Started';
  }

  scoreTierClass(score: number): string {
    if (score >= 80) return 'bg-success-subtle text-success-emphasis';
    if (score >= 70) return 'bg-info-subtle text-info-emphasis';
    if (score >= 40) return 'bg-warning-subtle text-warning-emphasis';
    return 'bg-secondary-subtle text-secondary-emphasis';
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
