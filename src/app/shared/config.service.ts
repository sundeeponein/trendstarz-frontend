import { map } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class ConfigService {
  // Stub for brand username uniqueness check
  checkBrandUsernameUnique(username: string) {
    return this.http.get<boolean>(`${this.apiUrl}/brands/check-username-unique?username=${encodeURIComponent(username)}`)
      .pipe(catchError(() => of(true)));
  }
  private apiUrl = environment.apiBaseUrl || '/api';

  constructor(private http: HttpClient) {}

  // Check if username exists (for async validation)
  checkUsernameExists(username: string) {
    return this.http.get<{ exists: boolean }>(`${this.apiUrl}/users/check-username/${encodeURIComponent(username)}`)
      .pipe(map(res => !!res.exists), catchError(() => of(false)));
  }


  // Fetch influencer by ID (for public profile view)
  getInfluencerById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/influencers/${id}`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError(() => of(null)),
    );
  }

  // Fetch brand by ID (for public profile view)
  getBrandById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/brands/${id}`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError(() => of(null)),
    );
  }

  // Fetch brand by name (for public profile view)
  getBrandByName(brandName: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/brands/name/${encodeURIComponent(brandName)}`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError((error) => {
        console.error('Error fetching brand by name:', error);
        return of(null);
      })
    );
  }

  registerInfluencer(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register-influencer`, data);
  }

  registerBrand(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register-brand`, data);
  }

  getAppSettings(): Observable<{
    preApproveInfluencers: boolean; influencerRequireEmailVerified: boolean; influencerRequireMobileVerified: boolean;
    preApproveBrands: boolean; brandRequireEmailVerified: boolean; brandRequireMobileVerified: boolean;
  }> {
    return this.http.get<any>(`${this.apiUrl}/auth/app-settings`).pipe(
      map(res => ({
        preApproveInfluencers: !!res?.preApproveInfluencers,
        influencerRequireEmailVerified: res?.influencerRequireEmailVerified !== false,
        influencerRequireMobileVerified: !!res?.influencerRequireMobileVerified,
        preApproveBrands: !!res?.preApproveBrands,
        brandRequireEmailVerified: res?.brandRequireEmailVerified !== false,
        brandRequireMobileVerified: !!res?.brandRequireMobileVerified,
      })),
      catchError(() => of({
        preApproveInfluencers: false, influencerRequireEmailVerified: true, influencerRequireMobileVerified: false,
        preApproveBrands: false, brandRequireEmailVerified: true, brandRequireMobileVerified: false,
      }))
    );
  }

  sendEmailVerificationLink(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/send-email-verification`, { email });
  }

  // Send forgot password link to email
  sendForgotPasswordLink(email: string) {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  // Reset password using token
  resetPassword(token: string, newPassword: string) {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, { token, newPassword });
  }

  getCategories(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/categories`).pipe(
      map((res) => this.extractData<any[]>(res) || [])
    );
  }

  getConfig(): Observable<any> {
    return this.http.get('/assets/admin-config.json').pipe(
      catchError(() => this.http.get('assets/admin-config.json')) // fallback for some setups
    );
  }

  getSampleUsers(): Observable<any[]> {
    return this.http.get<any[]>('/assets/sample-users.json').pipe(
      catchError(() => this.http.get<any[]>('assets/sample-users.json'))
    );
  }

  getStates(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/states`).pipe(
      map((res) => this.extractData<any[]>(res) || [])
    );
  }

  getLanguages(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/languages`).pipe(
      map((res) => this.extractData<any[]>(res) || [])
    );
  }

  getTiers(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/tiers`).pipe(
      map((res) => this.extractData<any[]>(res) || [])
    );
  }

  getSocialMedia(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/social-media`).pipe(
      map((res) => this.extractData<any[]>(res) || [])
    );
  }

  private extractData<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data as T;
    }
    return payload as T;
  }

  getInfluencers(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/users/influencers`).pipe(
      map((res) => {
        const data = this.extractData<any>(res);
        return (data?.data || data || []) as any[];
      }),
      catchError(() => of([]))
    );
  }

  getBrands(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/users/brands`).pipe(
      map((res) => {
        const data = this.extractData<any>(res);
        return (data?.data || data || []) as any[];
      }),
      catchError(() => of([]))
    );
  }

  updateBrandImages(id: string, images: { brandLogo?: any[]; products?: any[] }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${id}/images`, images);
  }

  updateUserImages(id: string, images: { profileImages?: any[]; brandLogo?: any[]; products?: any[] }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${id}/images`, images);
  }


  getInfluencerProfileById(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/influencer-profile`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError((err) => {
        console.error('Error fetching influencer profile:', err);
        return of(null);
      })
    );
  }

  updateInfluencerProfile(data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/influencer-profile`, data);
  }

  getBrandProfileById(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/brand-profile`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError((err) => {
        console.error('Error fetching brand profile:', err);
        return of(null);
      })
    );
  }

  updateBrandProfile(data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/brand-profile`, data);
  }


  setPremiumForCurrentUser(isPremium: boolean, premiumDuration: '1m' | '3m' | '1y'): Observable<any> {
    return new Observable((observer) => {
      this.getInfluencerProfileById().subscribe({
        next: (profile: any) => {
          if (!profile || !profile._id) {
            observer.error('User ID not found');
            return;
          }
          this.http.patch(`${this.apiUrl}/users/${profile._id}/premium`, { isPremium, premiumDuration })
            .subscribe({
              next: (res) => observer.next(res),
              error: (err) => observer.error(err),
              complete: () => observer.complete()
            });
        },
        error: (err) => observer.error(err)
      });
    });
  }

  /** Fetch current user's recent payments (for profile status display) */
  getMyPayments(limit = 5): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/payment/my?limit=${limit}`).pipe(
      map(res => {
        const d = this.extractData<any>(res);
        return Array.isArray(d?.payments) ? d.payments : Array.isArray(d) ? d : [];
      }),
      catchError(() => of([]))
    );
  }

  // Place this inside ConfigService class
  getInfluencerByUsername(username: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/influencers/username/${encodeURIComponent(username)}`).pipe(
      map(res => this.extractData<any>(res)),
      catchError(() => of(null)),
    );
  }

  // ── Campaign endpoints ──────────────────────
  /** Fetch all campaigns (optionally filter by status) — used for influencer browse view */
  getAllCampaigns(status?: string): Observable<any[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.http.get<any>(`${this.apiUrl}/campaigns${qs}`).pipe(
      map(res => {
        const d = this.extractData<any>(res);
        return (Array.isArray(d) ? d : d?.data ?? []) as any[];
      }),
      catchError(() => of([]))
    );
  }

  getCampaignsByBrandName(brandName: string): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaigns/brand-name/${encodeURIComponent(brandName)}`).pipe(
      map(res => {
        const data = this.extractData<any>(res);
        return Array.isArray(data) ? data : [];
      }),
      catchError(() => of([])),
    );
  }

  getCampaignsByBrandId(brandId: string): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaigns?brandId=${encodeURIComponent(brandId)}`).pipe(
      map(res => {
        const data = this.extractData<any>(res);
        return Array.isArray(data) ? data : [];
      }),
      catchError(() => of([])),
    );
  }

  createCampaign(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaigns`, data);
  }

  updateCampaign(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaigns/${id}`, data);
  }

  deleteCampaign(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/campaigns/${id}`);
  }

  // ── Campaign Invite endpoints ───────────────
  createCampaignInvite(data: { campaignId: string; influencerId: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites`, data);
  }

  getInvitesByCampaign(campaignId: string): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/campaign/${campaignId}`).pipe(
      map(res => { const d = this.extractData<any>(res); return Array.isArray(d) ? d : (d?.data ?? []); }),
      catchError(() => of([]))
    );
  }

  getMyInvites(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/influencer`).pipe(
      map(res => { const d = this.extractData<any>(res); return Array.isArray(d) ? d : (d?.data ?? []); }),
      catchError(() => of([]))
    );
  }

  respondToInvite(inviteId: string, status: 'accepted' | 'declined'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/respond`, { status });
  }

  submitInviteAnalytics(inviteId: string, analytics: { reach?: number; engagement?: number; clicks?: number }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/analytics`, analytics);
  }
}
