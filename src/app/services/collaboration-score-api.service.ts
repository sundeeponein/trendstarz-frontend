import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { environment } from "../../environments/environment";

// Backend wraps every response in { success, data } via a global Nest
// interceptor (response.interceptor.ts) unless the payload already has a
// `success` key. Every other frontend service unwraps this defensively —
// this one didn't, which is why fields silently read as undefined.
function unwrap<T>(res: any): T {
  return (res && typeof res === "object" && "data" in res ? res.data : res) as T;
}

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
  /** This platform's own Content Quality + Posting Consistency in isolation (0-100) — shown alongside, never instead of, the real collaborationScore. */
  miniScore?: number;
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
  status?: "completed" | "failed" | "pending";
  createdAt: string;
  // Self/admin only — brand-role responses never include these.
  platformsCollected?: CollaborationScorePlatformCollected[];
  canReanalyze?: boolean;
  reanalysisAvailableAt?: string | null;
  reanalysisFeeRupees?: number;
  // Self/admin only — whether a Sync Latest Profile has detected a change
  // since the current audit. Folded into canReanalyze server-side; surfaced
  // here too so the UI can show the right reason a Re-analyze is disabled.
  hasChanges?: boolean;
}

export interface CollaborationSyncPlatformStatus {
  platform: string;
  lastSyncedAt: string | null;
  hasChanges: boolean;
}

export interface CollaborationSyncResult {
  platforms: CollaborationSyncPlatformStatus[];
  hasChanges: boolean;
}

export interface CollaborationReanalysisPayment {
  amountRupees: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  archived: boolean;
}

export interface CollaborationAuditHistoryEntry {
  version: number;
  collaborationScore: number;
  campaignReadiness: string;
  trendstarzRecommended: boolean;
  isPaid: boolean;
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
  // Debug-only — lets the admin page prove a Save actually persisted
  // (updatedAt changes) and that repeated loads read the same document
  // (_id stays stable), without needing server log access.
  _id?: string | null;
  updatedAt?: string | null;
  _serverInstanceId?: string | null;
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
  syncEnabled: boolean;
  syncCooldownMinutes: number;
  allowManualSync: boolean;
  requireSyncBeforeReanalysis: boolean;
  youtubeApiQuotaGuardPerDay: number;
  analytics: CollaborationScoreAnalyticsToggles;
  lastNightlyRunAt: string | null;
  lastNightlyRunCount: number;
  lastNightlyRunCostUsd: number;
}

export interface SocialConnectionDetail {
  handle: string | null;
  followersCount: number | null;
  connectedAt: string;
}

export interface SocialConnections {
  instagram: SocialConnectionDetail | null;
  facebook: SocialConnectionDetail | null;
}

export interface CollaborationScorePreview {
  platform: "YouTube";
  handle: string;
  previewScore: number;
  confidence: number;
  confidenceReason: string;
}

export interface CollaborationScoreTodayPlatformCount {
  platform: string;
  count: number;
  aiCount: number;
  paidCount: number;
}

export interface CollaborationScoreTodaySummary {
  audits: number;
  aiCalls: number;
  // Null when analytics.trackAuditCost is turned off in settings.
  estimatedCostUsd: number | null;
  averageCostUsd: number | null;
  successCount: number;
  failureCount: number;
  platformBreakdown: CollaborationScoreTodayPlatformCount[];
}

@Injectable({ providedIn: "root" })
export class CollaborationScoreApiService {
  private readonly apiUrl = environment.apiBaseUrl || "/api";

  constructor(private readonly http: HttpClient) {}

  getAudit(userId: string): Observable<CollaborationAudit> {
    return this.http
      .get<CollaborationAudit>(`${this.apiUrl}/audit/${userId}`)
      .pipe(map((res) => unwrap<CollaborationAudit>(res)));
  }

  /** Anonymous, pre-registration teaser — no auth header, nothing saved server-side. */
  previewFromYoutubeUrl(youtubeUrl: string): Observable<CollaborationScorePreview> {
    return this.http
      .post<CollaborationScorePreview>(`${this.apiUrl}/audit/preview`, { youtubeUrl })
      .pipe(map((res) => unwrap<CollaborationScorePreview>(res)));
  }

  /**
   * Public, no auth header — lets every platform-picker UI (anonymous /audit
   * page, Connect buttons, Platform Status) hide a platform an admin has
   * disabled in Collaboration Score Settings, without needing a JWT.
   */
  getPlatformFlags(): Observable<{ platformsEnabled: CollaborationScorePlatformsEnabled }> {
    return this.http
      .get<{ platformsEnabled: CollaborationScorePlatformsEnabled }>(`${this.apiUrl}/audit/platform-flags`)
      .pipe(map((res) => unwrap<{ platformsEnabled: CollaborationScorePlatformsEnabled }>(res)));
  }

  /** Self/admin only — every past version, newest first. */
  getAuditHistory(userId: string, limit = 10): Observable<{ history: CollaborationAuditHistoryEntry[] }> {
    return this.http
      .get<{ history: CollaborationAuditHistoryEntry[] }>(`${this.apiUrl}/audit/${userId}/history`, {
        params: { limit: String(limit) },
      })
      .pipe(map((res) => unwrap<{ history: CollaborationAuditHistoryEntry[] }>(res)));
  }

  /** Self/admin only — a specific past audit version's full historical snapshot. */
  getAuditVersion(userId: string, version: number): Observable<CollaborationAudit> {
    return this.http
      .get<CollaborationAudit>(`${this.apiUrl}/audit/${userId}/version/${version}`)
      .pipe(map((res) => unwrap<CollaborationAudit>(res)));
  }

  /** Admin-only — every re-analysis payment for one creator. */
  getReanalysisPayments(userId: string): Observable<{ payments: CollaborationReanalysisPayment[] }> {
    return this.http
      .get<{ payments: CollaborationReanalysisPayment[] }>(`${this.apiUrl}/audit/${userId}/payments`)
      .pipe(map((res) => unwrap<{ payments: CollaborationReanalysisPayment[] }>(res)));
  }

  /** Self-trigger ("Re-Analyze" button) — backend infers requester from the JWT. Free only for the first-ever audit. */
  runMyAudit(): Observable<CollaborationAudit> {
    return this.http
      .post<CollaborationAudit>(`${this.apiUrl}/audit/run`, {})
      .pipe(map((res) => unwrap<CollaborationAudit>(res)));
  }

  /** Creates a Razorpay order for a paid re-analysis (every audit after the first). */
  createReanalysisOrder(): Observable<{ order: { orderId: string; amount: number; currency: string; keyId: string } }> {
    return this.http
      .post<any>(`${this.apiUrl}/audit/reanalysis/order`, {})
      .pipe(map((res) => unwrap<{ order: { orderId: string; amount: number; currency: string; keyId: string } }>(res)));
  }

  /** Verifies the Razorpay payment, then runs and returns the new audit. */
  verifyReanalysisPayment(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): Observable<CollaborationAudit> {
    return this.http
      .post<CollaborationAudit>(`${this.apiUrl}/audit/reanalysis/verify`, payload)
      .pipe(map((res) => unwrap<CollaborationAudit>(res)));
  }

  /** Admin-on-behalf-of trigger — requires an admin JWT server-side. */
  runAuditFor(userId: string, role: string): Observable<CollaborationAudit> {
    return this.http
      .post<CollaborationAudit>(`${this.apiUrl}/audit/run`, { userId, role })
      .pipe(map((res) => unwrap<CollaborationAudit>(res)));
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
    return this.http.get<any>(`${this.apiUrl}/audit/admin`, { params }).pipe(map((res) => unwrap<any>(res)));
  }

  getSettings(): Observable<CollaborationScoreSettings> {
    return this.http
      .get<CollaborationScoreSettings>(`${this.apiUrl}/audit/settings`)
      .pipe(map((res) => unwrap<CollaborationScoreSettings>(res)));
  }

  updateSettings(payload: Partial<CollaborationScoreSettings>): Observable<CollaborationScoreSettings> {
    return this.http
      .put<CollaborationScoreSettings>(`${this.apiUrl}/audit/settings`, payload)
      .pipe(map((res) => unwrap<CollaborationScoreSettings>(res)));
  }

  /** Deletes the current config and re-seeds the JSON defaults. */
  resetSettings(): Observable<CollaborationScoreSettings> {
    return this.http
      .post<CollaborationScoreSettings>(`${this.apiUrl}/audit/settings/reset`, {})
      .pipe(map((res) => unwrap<CollaborationScoreSettings>(res)));
  }

  /** Returns the Meta consent URL to redirect the browser to. */
  getConnectUrl(platform: "instagram" | "facebook"): Observable<{ authorizationUrl: string }> {
    return this.http
      .get<{ authorizationUrl: string }>(`${this.apiUrl}/audit/connect/${platform}`)
      .pipe(map((res) => unwrap<{ authorizationUrl: string }>(res)));
  }

  disconnectPlatform(platform: "instagram" | "facebook"): Observable<{ success: boolean }> {
    return this.http
      .post<{ success: boolean }>(`${this.apiUrl}/audit/disconnect/${platform}`, {})
      .pipe(map((res) => unwrap<{ success: boolean }>(res)));
  }

  getConnections(): Observable<SocialConnections> {
    return this.http
      .get<SocialConnections>(`${this.apiUrl}/audit/connections`)
      .pipe(map((res) => unwrap<SocialConnections>(res)));
  }

  /** Self-only — per-platform last-synced/hasChanges state, read on Score Center load. */
  getSyncStatus(): Observable<CollaborationSyncResult> {
    return this.http
      .get<CollaborationSyncResult>(`${this.apiUrl}/audit/sync-status`)
      .pipe(map((res) => unwrap<CollaborationSyncResult>(res)));
  }

  /** Self-only — free "Sync Latest Profile". Never scores, never charges, never creates audit history. */
  syncLatestProfile(): Observable<CollaborationSyncResult> {
    return this.http
      .post<CollaborationSyncResult>(`${this.apiUrl}/audit/sync`, {})
      .pipe(map((res) => unwrap<CollaborationSyncResult>(res)));
  }
}
