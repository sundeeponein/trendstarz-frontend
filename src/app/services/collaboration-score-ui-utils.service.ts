import { Injectable } from '@angular/core';
import { CollaborationAudit } from './collaboration-score-api.service';

export type ScoreConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface ScoreConfidenceBasedOnItem {
  met: boolean;
  label: string;
  absentLabel: string;
}

export interface ScoreConfidence {
  level: ScoreConfidenceLevel;
  basedOn: ScoreConfidenceBasedOnItem[];
}

export interface SubScoreRow {
  label: string;
  value: number;
  weight: string;
  contribution: number;
}

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

  /** Solid color (not a Bootstrap class) for the score-ring's conic-gradient — same 4 tiers as scoreTierClass/scoreTierLabel. */
  scoreRingColor(score: number): string {
    if (score >= 90) return '#1a7f4e';
    if (score >= 75) return '#3b5bdb';
    if (score >= 50) return '#c2650a';
    return '#c92a2a';
  }

  /**
   * The 5 weighted criteria behind a single collaborationScore total, each
   * with its point Contribution (weight × score ÷ 100) — single source of
   * truth shared by the creator's own Score Center and the admin detail
   * page, so both always show identical numbers. Weight percentages mirror
   * the default admin-configurable scoreWeights (Collaboration Score
   * Settings → Score Weights) — not persisted per-audit, so Contribution
   * reflects the current defaults rather than whatever was actually
   * configured at the moment a given audit ran.
   */
  subScores(audit: CollaborationAudit | null): SubScoreRow[] {
    if (!audit || audit.profileCompletenessScore == null) return [];
    const rows = [
      { label: 'Profile Completeness', value: audit.profileCompletenessScore ?? 0, weightPercent: 15 },
      { label: 'Content Quality', value: audit.contentQualityScore ?? 0, weightPercent: 25 },
      { label: 'Posting Consistency', value: audit.postingConsistencyScore ?? 0, weightPercent: 20 },
      { label: 'Professional Branding', value: audit.professionalBrandingScore ?? 0, weightPercent: 20 },
      { label: 'Campaign Readiness', value: audit.campaignReadinessScore ?? 0, weightPercent: 20 },
    ];
    return rows.map((r) => ({
      label: r.label,
      value: r.value,
      weight: `${r.weightPercent}%`,
      contribution: Math.round(r.value * r.weightPercent) / 100,
    }));
  }

  /** Sum of each row's Contribution — the pre-rounding total; audit.collaborationScore is this, rounded server-side. */
  subScoresTotal(subScores: SubScoreRow[]): number {
    return Math.round(subScores.reduce((sum, s) => sum + s.contribution, 0) * 100) / 100;
  }

  /** "Verified" = real API data; "Beta" = self-reported (capped, unverified); "Not available" = no usable data. */
  confidenceLabel(confidence: number): string {
    if (confidence >= 90) return 'Verified';
    if (confidence > 0) return 'Beta';
    return 'Not available';
  }

  /**
   * How much real (API-verified or self-reported) data the current score is
   * actually based on — a rich, connected platform should read as more
   * trustworthy than a bare, unconnected one, for both the creator and any
   * brand/admin who eventually sees this. Derived entirely from
   * audit.platformsCollected confidence values — no new backend field.
   */
  scoreConfidence(audit: CollaborationAudit | null): ScoreConfidence | null {
    if (!audit) return null;
    const platforms = audit.platformsCollected || [];
    const maxConfidence = platforms.length ? Math.max(...platforms.map((p) => p.confidence || 0)) : 0;
    const level: ScoreConfidenceLevel = maxConfidence >= 85 ? 'High' : maxConfidence >= 50 ? 'Medium' : 'Low';

    // Confidence > 0 required, not just "present in platformsCollected" — a
    // platform with 0% confidence (e.g. self-reported with no stats filled
    // in) is excluded from the score entirely by the rules engine, so
    // showing it as "met" here would contradict the Platform Confidence
    // section, which correctly calls it out as unavailable.
    const hasPlatform = (name: string) => platforms.some((p) => p.platform === name && (p.confidence || 0) > 0);
    const basedOn: ScoreConfidenceBasedOnItem[] = [
      { met: true, label: 'TrendStarZ Profile', absentLabel: 'TrendStarZ Profile' },
      { met: hasPlatform('YouTube'), label: 'YouTube', absentLabel: 'YouTube not added' },
      { met: hasPlatform('Instagram'), label: 'Instagram', absentLabel: 'Instagram not connected' },
      { met: hasPlatform('Facebook'), label: 'Facebook', absentLabel: 'Facebook not connected' },
      // LinkedIn has no OAuth support at all yet — never "met", always shown
      // as its own informational state rather than a real absent/connected pair.
      { met: false, label: 'LinkedIn', absentLabel: 'LinkedIn (Coming Soon)' },
    ];
    return { level, basedOn };
  }

  /** "Today, 14:22" / "29 Jul 2026, 14:22" — date+time for the mockup's LAST ANALYSIS line. */
  lastAnalysisDateTime(audit: Pick<CollaborationAudit, 'createdAt'> | null): string {
    if (!audit?.createdAt) return '';
    const date = new Date(audit.createdAt);
    const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const isToday = new Date().toDateString() === date.toDateString();
    const day = isToday ? 'Today' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${day}, ${time}`;
  }
}
