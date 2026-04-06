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

export interface Plan {
  _id?: string;
  code?: string;
  name: string;
  userType: 'INFLUENCER' | 'BRAND';
  price: { monthly: number; quarterly?: number; yearly: number };
  features: PlanFeature[];
  limits: PlanLimit[];
  policies: { imageRetentionDaysAfterExpiry: number };
  highlight?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface PlanCapabilities {
  hasPremium: boolean;
  planName: string;
  features: PlanFeature[];
  limits: PlanLimit[];
  policies: { imageRetentionDaysAfterExpiry: number };
  endDate: string | null;
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
    { key: 'maxImages', label: 'Max Images Upload', value: 2 },
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

  /** Public: fetch active plans for a given user type */
  getActivePlans(userType?: string): Observable<Plan[]> {
    const normalizedType = userType ? userType.toUpperCase() : undefined;
    const url = normalizedType
      ? `${environment.apiBaseUrl}/plans?userType=${normalizedType}`
      : `${environment.apiBaseUrl}/plans`;
    return this.http.get<any>(url).pipe(
      map(r => r.plans ?? []),
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
        map(r => r.plans ?? []),
        catchError(err => { throw err; }),
      );
  }

  adminCreate(dto: Partial<Plan>): Observable<Plan> {
    return this.http
      .post<any>(`${environment.apiBaseUrl}/plans/admin`, dto, { headers: this.getHeaders() })
      .pipe(map(r => r.plan));
  }

  adminUpdate(id: string, dto: Partial<Plan>): Observable<Plan> {
    return this.http
      .patch<any>(`${environment.apiBaseUrl}/plans/admin/${id}`, dto, { headers: this.getHeaders() })
      .pipe(map(r => r.plan));
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
