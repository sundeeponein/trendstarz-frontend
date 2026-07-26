import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

export interface CollaborationScorePricingSuggestion {
  reelPrice: number | null;
  storyPrice: number | null;
  videoPrice: number | null;
  currency: string;
  basis: string;
}

export interface CollaborationScorePlatformCollected {
  platform: string;
  method: "API" | "SELF_REPORTED";
  handle?: string;
  collectedAt?: string;
  confidence: number;
  confidenceReason: string;
}

export interface CollaborationAudit {
  userId: string;
  userType: "Influencer" | "Brand" | "Photographer";
  version?: number;
  // Sub-score breakdown — only present for self/admin views, stripped from
  // the brand-facing response server-side.
  profileCompletenessScore?: number;
  contentQualityScore?: number;
  postingConsistencyScore?: number;
  professionalBrandingScore?: number;
  campaignReadinessScore?: number;
  collaborationScore: number;
  portfolioScore: number | null;
  campaignReadiness: "Campaign Ready" | "Partially Ready" | "Not Ready";
  trendstarzRecommended: boolean;
  // Self/admin only — threshold snapshot at compute time, used for "Need +N points" messaging.
  trendstarzRecommendedMinScore?: number;
  pricingSuggestion: CollaborationScorePricingSuggestion;
  categoryMatch: string[];
  strengths?: string[];
  improvements?: string[];
  recommendations?: string[];
  aiUsed?: boolean;
  createdAt: string;
  // Self/admin only — brand-role responses never include these.
  platformsCollected?: CollaborationScorePlatformCollected[];
  canReanalyze?: boolean;
  reanalysisAvailableAt?: string | null;
  reanalysisFeeRupees?: number;
}

export interface CollaborationAuditHistoryEntry {
  version: number;
  collaborationScore: number;
  campaignReadiness: string;
  trendstarzRecommended: boolean;
  createdAt: string;
  scoreDelta: number | null;
}

export interface CollaborationScorePlatformsEnabled {
  instagram: boolean;
  youtube: boolean;
  facebook: boolean;
  linkedin: boolean;
}

export interface CollaborationScoreAnalyticsToggles {
  trackAuditCost: boolean;
  trackAverageScore: boolean;
  trackPlatformUsage: boolean;
  trackAuditHistory: boolean;
}

export interface CollaborationScoreWeights {
  profileCompletion: number;
  contentQuality: number;
  postingConsistency: number;
  professionalBranding: number;
  campaignReadiness: number;
}

export interface CollaborationScoreSettings {
  schemaVersion: number;
  aiEnabled: boolean;
  aiModel: string;
  anonymousPreviewEnabled: boolean;
  freeAuditCount: number;
  auditValidityDays: number;
  weights: {
    contentQuality: { rulesPercent: number; aiPercent: number };
    professionalBranding: { rulesPercent: number; aiPercent: number };
  };
  thresholds: {
    trendstarzRecommendedMinScore: number;
    campaignReadyMinScore: number;
    partiallyReadyMinScore: number;
  };
  // Top-level criteria weights for the overall collaborationScore — must sum to 100.
  scoreWeights: CollaborationScoreWeights;
  version2Enabled: boolean;
  version1Name: string;
  version2Name: string;
  platformsEnabled: CollaborationScorePlatformsEnabled;
  reanalysisCooldownDays: number;
  reanalysisFeeRupees: number;
  nightlyReauditEnabled: boolean;
  nightlyReauditCronHour: number;
  youtubeApiQuotaGuardPerDay: number;
  analytics: CollaborationScoreAnalyticsToggles;
  lastNightlyRunAt: string | null;
  lastNightlyRunCount: number;
  lastNightlyRunCostUsd: number;
}

export interface CollaborationScorePreview {
  platform: "YouTube";
  handle: string;
  previewScore: number;
  confidence: number;
  confidenceReason: string;
}

export interface CollaborationScoreTodaySummary {
  audits: number;
  aiCalls: number;
  // Null when analytics.trackAuditCost is turned off in settings.
  estimatedCostUsd: number | null;
  averageCostUsd: number | null;
  successCount: number;
  failureCount: number;
}

@Injectable({ providedIn: "root" })
export class CollaborationScoreApiService {
  private readonly apiUrl = environment.apiBaseUrl || "/api";

  constructor(private readonly http: HttpClient) {}

  getAudit(userId: string): Observable<CollaborationAudit> {
    return this.http.get<CollaborationAudit>(`${this.apiUrl}/audit/${userId}`);
  }

  /** Anonymous, pre-registration teaser — no auth header, nothing saved server-side. */
  previewFromYoutubeUrl(youtubeUrl: string): Observable<CollaborationScorePreview> {
    return this.http.post<CollaborationScorePreview>(`${this.apiUrl}/audit/preview`, { youtubeUrl });
  }

  /** Self/admin only — every past version, newest first. */
  getAuditHistory(userId: string, limit = 10): Observable<{ history: CollaborationAuditHistoryEntry[] }> {
    return this.http.get<{ history: CollaborationAuditHistoryEntry[] }>(
      `${this.apiUrl}/audit/${userId}/history`,
      { params: { limit: String(limit) } },
    );
  }

  /** Self-trigger ("Re-Analyze" button) — backend infers requester from the JWT. Free only for the first-ever audit. */
  runMyAudit(): Observable<CollaborationAudit> {
    return this.http.post<CollaborationAudit>(`${this.apiUrl}/audit/run`, {});
  }

  /** Creates a Razorpay order for a paid re-analysis (every audit after the first). */
  createReanalysisOrder(): Observable<{ order: { orderId: string; amount: number; currency: string; keyId: string } }> {
    return this.http.post<any>(`${this.apiUrl}/audit/reanalysis/order`, {});
  }

  /** Verifies the Razorpay payment, then runs and returns the new audit. */
  verifyReanalysisPayment(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Observable<CollaborationAudit> {
    return this.http.post<CollaborationAudit>(`${this.apiUrl}/audit/reanalysis/verify`, payload);
  }

  /** Admin-on-behalf-of trigger — requires an admin JWT server-side. */
  runAuditFor(userId: string, role: string): Observable<CollaborationAudit> {
    return this.http.post<CollaborationAudit>(`${this.apiUrl}/audit/run`, { userId, role });
  }

  getAdminList(query: {
    page?: number;
    limit?: number;
    userType?: string;
    trendstarzRecommended?: boolean;
    campaignReadiness?: string;
    summary?: boolean;
  }): Observable<{
    items: CollaborationAudit[];
    total: number;
    page: number;
    limit: number;
    summary?: any;
    todaySummary?: CollaborationScoreTodaySummary;
  }> {
    const params: Record<string, string> = {};
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params[key] = String(value);
    });
    return this.http.get<any>(`${this.apiUrl}/audit/admin`, { params });
  }

  getSettings(): Observable<CollaborationScoreSettings> {
    return this.http.get<CollaborationScoreSettings>(`${this.apiUrl}/audit/settings`);
  }

  updateSettings(payload: Partial<CollaborationScoreSettings>): Observable<CollaborationScoreSettings> {
    return this.http.put<CollaborationScoreSettings>(`${this.apiUrl}/audit/settings`, payload);
  }

  /** Deletes the current config and re-seeds the JSON defaults. */
  resetSettings(): Observable<CollaborationScoreSettings> {
    return this.http.post<CollaborationScoreSettings>(`${this.apiUrl}/audit/settings/reset`, {});
  }
}
