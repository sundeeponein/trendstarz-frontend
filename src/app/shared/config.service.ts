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

  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Fetch the admin-managed support contact (email / phone / whatsapp / message / enabled).
   * Public endpoint — safe to call from any page. Used by the campaign-management
   * "Need help?" / "Contact support" banner. Falls back to a sensible default
   * if the request fails so the UI never breaks.
   */
  getSupportContact(): Observable<{
    enabled: boolean;
    email: string;
    phone: string;
    whatsapp: string;
    message: string;
  }> {
    return this.http
      .get<any>(`${this.apiUrl}/public/support-contact`)
      .pipe(
        map((res) => {
          const d = res?.data ?? res ?? {};
          return {
            enabled: d.enabled !== false,
            email: d.email || 'support@trendstarz.in',
            phone: d.phone || '',
            whatsapp: d.whatsapp || '',
            message: d.message || '',
          };
        }),
        catchError(() =>
          of({
            enabled: true,
            email: 'support@trendstarz.in',
            phone: '',
            whatsapp: '',
            message: '',
          }),
        ),
      );
  }

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
        platformFeeEnabled: !!res?.platformFeeEnabled,
        platformFeePercent: typeof res?.platformFeePercent === 'number' ? res.platformFeePercent : 10,
        gstPercent: typeof res?.gstPercent === 'number' ? res.gstPercent : 18,
      })),
      catchError(() => of({
        preApproveInfluencers: false, influencerRequireEmailVerified: true, influencerRequireMobileVerified: false,
        preApproveBrands: false, brandRequireEmailVerified: true, brandRequireMobileVerified: false,
        platformFeeEnabled: false, platformFeePercent: 10, gstPercent: 18
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

  // Change password for logged-in user
  changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    return this.http.post(`${this.apiUrl}/auth/change-password`, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
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

  getDistricts(stateName?: string, stateId?: string): Observable<any[]> {
    let url = `${this.apiUrl}/districts`;
    const params: string[] = [];
    if (stateName) params.push(`state=${encodeURIComponent(stateName)}`);
    if (stateId) params.push(`stateId=${encodeURIComponent(stateId)}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.http.get<any>(url).pipe(
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

  setPremiumForUser(userId: string, isPremium: boolean, premiumDuration: '1m' | '3m' | '1y'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${userId}/premium`, { isPremium, premiumDuration });
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

  trackInfluencerProfileImpression(username: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/influencers/username/${encodeURIComponent(username)}/track-impression`, {});
  }

  trackInfluencerProfileClick(username: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/influencers/username/${encodeURIComponent(username)}/track-click`, {});
  }

  trackBrandProfileImpression(brandName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/brands/name/${encodeURIComponent(brandName)}/track-impression`, {});
  }

  trackBrandProfileClick(brandName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/brands/name/${encodeURIComponent(brandName)}/track-click`, {});
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

  inviteInfluencers(campaignId: string, influencerIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaigns/${campaignId}/invite-influencers`, { influencerIds });
  }

  calculateCampaignPayment(campaignId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-transactions/${campaignId}/calculate`, {});
  }

  getMyCampaignTransactions(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-transactions/my/history`).pipe(
      map(res => {
        const d = this.extractData<any>(res);
        return Array.isArray(d) ? d : (Array.isArray(res?.data) ? res.data : []);
      }),
      catchError(() => of([]))
    );
  }

  submitCampaignPaymentProof(campaignId: string, data: { utrNumber: string; paymentProofUrl?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-transactions/${campaignId}/submit-proof`, data);
  }

  deleteCampaign(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/campaigns/${id}`);
  }

  // ── Campaign Invite endpoints ───────────────
  createCampaignInvite(data: { campaignId: string; influencerId: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites`, data);
  }

  getInviteWithCampaign(inviteId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/${inviteId}`).pipe(
      catchError(() => of(null))
    );
  }

  getInvitesByCampaign(campaignId: string): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/campaign/${campaignId}`).pipe(
      map(res => { const d = this.extractData<any>(res); return Array.isArray(d) ? d : (d?.data ?? []); }),
      catchError(() => of([]))
    );
  }

  /** Brand: find a completed invite with a specific influencer (for review eligibility) */
  getCompletedInviteWithInfluencer(influencerId: string): Observable<any | null> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/brand/completed-with/${influencerId}`).pipe(
      map(res => res?.invite ?? null),
      catchError(() => of(null))
    );
  }

  getMyInvites(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/influencer`).pipe(
      map(res => { const d = this.extractData<any>(res); return Array.isArray(d) ? d : (d?.data ?? []); }),
      catchError(() => of([]))
    );
  }

  applyToOpenCampaign(campaignId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/campaign-invites/campaign/${campaignId}/apply`, {}).pipe(
      map(res => this.extractData<any>(res) || res)
    );
  }

  respondToInvite(
    inviteId: string,
    status: 'accepted' | 'declined',
    selectedPostDate?: string,
    selectedPlatform?: string,
    selectedContentType?: string,
    payout?: { upiId?: string; mobile?: string; accountHolderName?: string },
  ): Observable<any> {
    const body: any = { status };
    if (selectedPostDate) body.selectedPostDate = selectedPostDate;
    if (selectedPlatform) body.selectedPlatform = selectedPlatform;
    if (selectedContentType) body.selectedContentType = selectedContentType;
    if (payout && (payout.upiId || payout.mobile || payout.accountHolderName)) {
      body.payout = payout;
    }
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/respond`, body);
  }

  /** Brand-initiated contact unlock for an accepted invite. */
  unlockInviteContact(inviteId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites/${inviteId}/unlock`, {});
  }

  // ── Slice D: fulfillment ─────────────────────────────────────
  /** Brand updates product-shipping fulfillment for a `product` campaign invite. */
  updateInviteProductFulfillment(
    inviteId: string,
    body: {
      courier?: string;
      trackingId?: string;
      trackingUrl?: string;
      shippedAt?: string;
      deliveredAt?: string;
      status?: 'pending' | 'shipped' | 'delivered' | 'returned';
      note?: string;
    },
  ): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/fulfillment/product`, body);
  }

  /** Brand updates check-in / no-show for an `invite_location` campaign invite. */
  updateInviteCheckIn(
    inviteId: string,
    body: {
      status?: 'pending' | 'checked_in' | 'no_show' | 'cancelled';
      scheduledAt?: string;
      checkedInAt?: string;
      note?: string;
    },
  ): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/fulfillment/check-in`, body);
  }

  /** Brand sets the deliverable due-date for an invite. */
  setInviteDueDate(inviteId: string, dueDate: string | null): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/due-date`, { dueDate });
  }

  // ── Slice E: brand actions ───────────────────────────────────
  remindInvite(inviteId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites/${inviteId}/remind`, {});
  }

  withdrawInvite(inviteId: string, reason?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites/${inviteId}/withdraw`, { reason });
  }

  reportInviteIssue(inviteId: string, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites/${inviteId}/report`, { reason });
  }

  // ── Brand: needs-attention widget ────────────────────────────
  getBrandAttentionCounts(): Observable<{
    disputed: number;
    overdue: number;
    awaitingFulfillment: number;
  }> {
    return this.http.get<{ disputed: number; overdue: number; awaitingFulfillment: number }>(
      `${this.apiUrl}/campaign-invites/brand/attention-counts`,
    );
  }

  getInfluencerAttentionCounts(): Observable<{
    pendingInvites: number;
    overdueDeliverables: number;
    disputedAgainstMe: number;
  }> {
    return this.http.get<{ pendingInvites: number; overdueDeliverables: number; disputedAgainstMe: number }>(
      `${this.apiUrl}/campaign-invites/influencer/attention-counts`,
    );
  }

  // ── Admin: dispute oversight queue ───────────────────────────
  adminListDisputes(status: 'open' | 'resolved' | 'all' = 'open'): Observable<any> {
    return this.http.get(`${this.apiUrl}/campaign-invites/admin/disputes?status=${status}`);
  }

  adminCountOpenDisputes(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      `${this.apiUrl}/campaign-invites/admin/disputes/count`,
    );
  }

  adminBulkResolveDisputes(body: {
    inviteIds: string[];
    outcome?: 'completed' | 'withdrawn' | 'disputed';
    note?: string;
  }): Observable<{ success: boolean; resolved: number; skipped: number }> {
    return this.http.post<{ success: boolean; resolved: number; skipped: number }>(
      `${this.apiUrl}/campaign-invites/admin/disputes/bulk-resolve`,
      body,
    );
  }

  adminResolveDispute(
    inviteId: string,
    body: { outcome?: 'completed' | 'withdrawn' | 'disputed'; note?: string },
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/campaign-invites/admin/${inviteId}/resolve-dispute`,
      body,
    );
  }

  submitInviteAnalytics(inviteId: string, analytics: { reach?: number; engagement?: number; clicks?: number }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/analytics`, analytics);
  }

  // ── Campaign Submission endpoints ───────────────
  submitCampaignPost(inviteId: string, data: {
    postUrl: string;
    postType?: string;
    captionUsed?: string;
    postScreenshotUrl?: string;
    insightsScreenshotUrl?: string;
    viewsCount?: number;
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    reachCount?: number;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites/${inviteId}/submit`, data);
  }

  getSubmissionByInvite(inviteId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/${inviteId}/submission`);
  }

  getCampaignSubmissions(campaignId: string): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/campaign/${campaignId}/submissions`).pipe(
      map(res => {
        const d = res?.data ?? res;
        return Array.isArray(d) ? d : (d?.submissions ?? []);
      }),
      catchError(() => of([]))
    );
  }

  reviewCampaignSubmission(inviteId: string, data: { action: 'approve' | 'dispute'; feedback?: string; disputeReason?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/review`, data);
  }

  updateSubmissionStats(inviteId: string, stats: {
    viewsCount?: number;
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    reachCount?: number;
    insightsScreenshotUrl?: string;
  }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/stats`, stats);
  }

  /* ── Reviews ── */

  writeReview(data: { inviteId: string; rating: number; comment?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/reviews`, data);
  }

  getReviewsForTarget(targetId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/reviews/target/${targetId}`);
  }

  getMyWrittenReviews(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/reviews/my`);
  }

  adminGetPendingReviews(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/reviews/admin/pending`);
  }

  adminDecideReview(reviewId: string, action: 'approved' | 'rejected', adminNote?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/reviews/admin/${reviewId}`, { action, adminNote });
  }
}
