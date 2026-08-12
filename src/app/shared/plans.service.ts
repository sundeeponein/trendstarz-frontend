import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PlanFeature {
  key: string;
  label: string;
  value: boolean;
}

export interface PlanLimit {
  key: string;
  label: string;
  value: number;
}

export interface PlanOffer {
  key: string;
  label: string;
  value: number;
}

export interface Plan {
  _id?: string;
  code?: string;
  name: string;
  userType: 'INFLUENCER' | 'BRAND' | 'PHOTOGRAPHER';
  price: { monthly: number; quarterly: number; yearly: number };
  features: PlanFeature[];
  limits: PlanLimit[];
  offers?: PlanOffer[];
  policies: {
    imageRetentionDaysAfterExpiry: number;
  };
  highlight?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  discountLabel?: string;
  /** First-login Founder Launch Offer popup title — admin-renameable (e.g. "Festival Offer"). */
  founderOfferName?: string;
  /** Founder Launch Offer countdown window, in days. */
  founderOfferWindowDays?: number;
  /** Show the popup to users who registered within founderOfferWindowDays of now. */
  founderOfferForNewUsers?: boolean;
  /** Show the popup to users who registered before that window. */
  founderOfferForExistingUsers?: boolean;
  /** Optional cap for the role audience; 0 or empty means unlimited. */
  founderOfferAudienceCap?: number;
  /** Current total users for this plan role, returned by the API for launch cap checks. */
  founderOfferAudienceCount?: number;
  /** Optional date after which the Founder Offer no longer appears or grants bonuses. */
  founderOfferEndsAt?: string | Date | null;
}

export interface PlanCapabilities {
  hasPremium: boolean;
  planName: string;
  features: PlanFeature[];
  limits: PlanLimit[];
  policies: {
    imageRetentionDaysAfterExpiry: number;
  };
  endDate: string | null;
}

/**
 * Limit keys that exist on saved Plan documents (old defaults, or the
 * backend schema's own default limits list) for a feature that was never
 * actually built — no schema, no invite/management flow, no enforcement
 * anywhere. Filtered out wherever plan limits are displayed (admin editor,
 * the public Premium Upgrade comparison) so nobody — admin or paying
 * customer — is shown a cap that corresponds to nothing real. Remove a key
 * from this list once its feature actually ships.
 */
export const HIDDEN_PLAN_LIMIT_KEYS: string[] = ['maxTeamSeats'];

export function visiblePlanLimits(limits: PlanLimit[] | undefined | null): PlanLimit[] {
  return (limits || []).filter((l) => !HIDDEN_PLAN_LIMIT_KEYS.includes(l.key));
}

export const FREE_CAPABILITIES: PlanCapabilities = {
  hasPremium: false,
  planName: 'Free',
  features: [
    { key: 'socialMediaVisibility', label: 'Show Social Media Links', value: false },
    { key: 'contactVisibility', label: 'Show Contact Details', value: false },
    { key: 'priorityListing', label: 'Priority Listing in Search', value: false },
  ],
  limits: [
    { key: 'maxProductImages', label: 'Profile images', value: 3 },
    { key: 'maxPortfolioImages', label: 'Portfolio images', value: 3 },
    { key: 'maxCampaigns', label: 'Max Campaigns', value: 1 },
  ],
  policies: { imageRetentionDaysAfterExpiry: 45 },
  endDate: null,
};

@Injectable({ providedIn: 'root' })
export class PlansService {
  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getHeaders(): HttpHeaders {
    let token = '';
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('token') ?? sessionStorage.getItem('token') ?? '';
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private normalizePlan(plan: any): Plan {
    return {
      ...plan,
      price: {
        monthly: plan?.price?.monthly ?? 0,
        quarterly: plan?.price?.quarterly ?? 0,
        yearly: plan?.price?.yearly ?? 0,
      },
      features: plan?.features ?? [],
      limits: plan?.limits ?? [],
      offers: plan?.offers ?? [],
      policies: {
        imageRetentionDaysAfterExpiry:
          plan?.policies?.imageRetentionDaysAfterExpiry ?? 45,
      },
    } as Plan;
  }

  /** Public: fetch active plans for a given user type */
  getActivePlans(userType?: string): Observable<Plan[]> {
    const normalizedType = userType ? userType.toUpperCase() : undefined;
    const url = normalizedType
      ? `${environment.apiBaseUrl}/plans?userType=${normalizedType}`
      : `${environment.apiBaseUrl}/plans`;
    return this.http.get<any>(url).pipe(
      map(r => (r.plans ?? []).map((plan: any) => this.normalizePlan(plan))),
      catchError(() => of([])),
    );
  }

  /** Authenticated: get capabilities for the current user */
  getMyCapabilities(): Observable<PlanCapabilities> {
    return this.http
      .get<any>(`${environment.apiBaseUrl}/plans/my/capabilities`, {
        headers: this.getHeaders(),
      })
      .pipe(
        map(r => ({
          hasPremium: r.hasPremium,
          planName: r.planName,
          features: r.features ?? [],
          limits: r.limits ?? [],
          policies: r.policies ?? { imageRetentionDaysAfterExpiry: 45 },
          endDate: r.endDate ?? null,
        })),
        catchError(() => of(FREE_CAPABILITIES)),
      );
  }

  getFeatureValue(caps: PlanCapabilities, key: string): boolean {
    return caps.features.find(f => f.key === key)?.value ?? false;
  }

  getLimitValue(caps: PlanCapabilities, key: string): number {
    return caps.limits.find(l => l.key === key)?.value ?? 0;
  }

  // ── Admin APIs ────────────────────────────────────────────────────────────

  adminListAll(): Observable<Plan[]> {
    return this.http
      .get<any>(`${environment.apiBaseUrl}/plans/admin/all`, { headers: this.getHeaders() })
      .pipe(
        map(r => (r.plans ?? []).map((plan: any) => this.normalizePlan(plan))),
        catchError(err => { throw err; }),
      );
  }

  adminCreate(dto: Partial<Plan>): Observable<Plan> {
    return this.http
      .post<any>(`${environment.apiBaseUrl}/plans/admin`, dto, { headers: this.getHeaders() })
      .pipe(map(r => this.normalizePlan(r.plan)));
  }

  adminLoadFromConfig(): Observable<{ success: boolean; message: string; plans: Plan[] }> {
    return this.http
      .post<any>(`${environment.apiBaseUrl}/plans/admin/load-config`, {}, { headers: this.getHeaders() })
      .pipe(
        map(r => ({
          success: r.success === true,
          message: r.message ?? 'Plans loaded from config',
          plans: (r.plans ?? []).map((plan: any) => this.normalizePlan(plan)),
        })),
      );
  }

  adminUpdate(id: string, dto: Partial<Plan>): Observable<Plan> {
    return this.http
      .patch<any>(`${environment.apiBaseUrl}/plans/admin/${id}`, dto, { headers: this.getHeaders() })
      .pipe(map(r => this.normalizePlan(r.plan)));
  }

  adminDelete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiBaseUrl}/plans/admin/${id}`, { headers: this.getHeaders() });
  }

  adminSeedDefaults(): Observable<any> {
    return this.http
      .post<any>(`${environment.apiBaseUrl}/plans/admin/seed`, {}, { headers: this.getHeaders() });
  }
}
