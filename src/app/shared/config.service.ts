import { map, switchMap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  buildDefaultUserTagOptions,
} from './constants/user-tag-options.constants';


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

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private getAuthOptions() {
    const token = this.getToken();
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
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
    verificationCallNumber: string;
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
            verificationCallNumber: d.verificationCallNumber || '',
          };
        }),
        catchError(() =>
          of({
            enabled: true,
            email: 'support@trendstarz.in',
            phone: '',
            whatsapp: '',
            message: '',
            verificationCallNumber: '',
          }),
        ),
      );
  }

  getWhatsappCommunityForState(state: string): Observable<any | null> {
    const qs = state ? `?state=${encodeURIComponent(state)}` : '';
    return this.http.get<any>(`${this.apiUrl}/public/whatsapp-community${qs}`).pipe(
      map((res) => this.extractData<any>(res) || null),
      catchError(() => of(null)),
    );
  }

  getWhatsappCommunities(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/admin/whatsapp-communities`, this.getAuthOptions()).pipe(
      map((res) => this.extractData<any[]>(res) || []),
      catchError(() => of([])),
    );
  }

  createWhatsappCommunity(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/whatsapp-communities`, payload, this.getAuthOptions()).pipe(
      map((res) => this.extractData<any>(res) || res),
    );
  }

  updateWhatsappCommunity(id: string, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/admin/whatsapp-communities/${encodeURIComponent(id)}`, payload, this.getAuthOptions()).pipe(
      map((res) => this.extractData<any>(res) || res),
    );
  }

  deleteWhatsappCommunity(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/admin/whatsapp-communities/${encodeURIComponent(id)}`, this.getAuthOptions());
  }

  markSessionOpened(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/session/opened`, {}, this.getAuthOptions());
  }

  markCommunityJoined(communityName: string, communityState = ''): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/auth/community/joined`,
      { communityName, communityState },
      this.getAuthOptions(),
    );
  }

  getCampaignTypeConfigs(): Observable<Array<{
    key: string;
    label: string;
    ownerType: 'brand' | 'photographer';
    enabled: boolean;
    premiumOnly: boolean;
    sortOrder: number;
  }>> {
    return this.http.get<any>(`${this.apiUrl}/public/campaign-type-configs`).pipe(
      map((res) => {
        const data = res?.data ?? res ?? {};
        const items = Array.isArray(data?.items) ? data.items : [];
        return items
          .map((item: any) => ({
            key: String(item?.key || '').trim(),
            label: String(item?.label || '').trim(),
            ownerType: String(item?.ownerType || 'brand') === 'photographer' ? 'photographer' : 'brand',
            enabled: item?.enabled !== false,
            premiumOnly: item?.premiumOnly === true,
            sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : 999,
          }))
          .filter((item: any) => !!item.key && !!item.label)
          .sort((a: any, b: any) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      }),
      catchError(() => of([])),
    );
  }

  getCampaignAccessModeConfigs(): Observable<Array<{
    key: 'invite_only' | 'tier_filtered_open';
    label: string;
    enabled: boolean;
    premiumOnly: boolean;
    sortOrder: number;
  }>> {
    return this.http.get<any>(`${this.apiUrl}/public/campaign-type-configs`).pipe(
      map((res) => {
        const data = res?.data ?? res ?? {};
        const items = Array.isArray(data?.accessModes) ? data.accessModes : [];
        return items
          .map((item: any) => ({
            key: String(item?.key || item?.value) === 'tier_filtered_open' ? 'tier_filtered_open' : 'invite_only',
            label: String(item?.label || '').trim(),
            enabled: item?.enabled !== false,
            premiumOnly: item?.premiumOnly === true,
            sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : 999,
          }))
          .filter((item: any) => !!item.key && !!item.label)
          .sort((a: any, b: any) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      }),
      catchError(() => of([
        { key: 'invite_only' as const, label: 'Invite only', enabled: true, premiumOnly: false, sortOrder: 10 },
        { key: 'tier_filtered_open' as const, label: 'Open to all', enabled: true, premiumOnly: false, sortOrder: 20 },
      ])),
    );
  }

  // Check if username exists (for async validation)
  checkUsernameExists(username: string) {
    return this.http.get<{ exists: boolean }>(`${this.apiUrl}/users/check-username/${encodeURIComponent(username)}`)
      .pipe(map(res => !!res.exists), catchError(() => of(false)));
  }

  checkRegistrationConflicts(payload: {
    userType: 'INFLUENCER' | 'BRAND';
    username?: string;
    brandUsername?: string;
    brandName?: string;
    email?: string;
    phoneNumber?: string;
  }): Observable<{
    username: boolean;
    brandUsername: boolean;
    brandName: boolean;
    email: boolean;
    phoneNumber: boolean;
    duplicateFields: string[];
  }> {
    const params = new URLSearchParams();
    params.set('userType', payload.userType);
    if (payload.username) params.set('username', payload.username);
    if (payload.brandUsername) params.set('brandUsername', payload.brandUsername);
    if (payload.brandName) params.set('brandName', payload.brandName);
    if (payload.email) params.set('email', payload.email);
    if (payload.phoneNumber) params.set('phoneNumber', payload.phoneNumber);

    return this.http.get<any>(`${this.apiUrl}/users/check-registration-conflicts?${params.toString()}`).pipe(
      map((res: any) => {
        const data = res?.data ?? res ?? {};
        return {
          username: !!data.username,
          brandUsername: !!data.brandUsername,
          brandName: !!data.brandName,
          email: !!data.email,
          phoneNumber: !!data.phoneNumber,
          duplicateFields: Array.isArray(data.duplicateFields) ? data.duplicateFields : [],
        };
      }),
      catchError(() =>
        of({
          username: false,
          brandUsername: false,
          brandName: false,
          email: false,
          phoneNumber: false,
          duplicateFields: [],
        }),
      ),
    );
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

  registerPhotographer(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register-photographer`, data);
  }

  uploadImage(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/upload-image`, formData).pipe(
      map((res) => {
        const data = this.extractData<any>(res) || res || {};
        return {
          ...data,
          url: data?.url || data?.secure_url || '',
          public_id: data?.public_id || data?.publicId || '',
        };
      }),
    );
  }

  getAppSettings(): Observable<{
    preApproveInfluencers: boolean; influencerRequireEmailVerified: boolean; influencerRequireMobileVerified: boolean;
    preApproveBrands: boolean; brandRequireEmailVerified: boolean; brandRequireMobileVerified: boolean;
    platformFeeEnabled?: boolean;
    platformFeePercent?: number;
    gstPercent?: number;
    paymentUpiId?: string;
    submissionApprovalWaitHours?: number;
    submissionAutoCompleteGraceHours?: number;
    payoutReleaseWaitHours?: number;
    otpVerificationEnabled?: boolean;
    showSearchLink: boolean;
    showRegisterInfluencerLink: boolean;
    showRegisterBrandLink: boolean;
    showRegisterPhotographerLink: boolean;
  }> {
    return this.http.get<any>(`${this.apiUrl}/auth/app-settings`).pipe(
      map(res => {
        const data = res?.data ?? res ?? {};
        return {
          preApproveInfluencers: !!data?.preApproveInfluencers,
          influencerRequireEmailVerified: data?.influencerRequireEmailVerified !== false,
          influencerRequireMobileVerified: !!data?.influencerRequireMobileVerified,
          preApproveBrands: !!data?.preApproveBrands,
          brandRequireEmailVerified: data?.brandRequireEmailVerified !== false,
          brandRequireMobileVerified: !!data?.brandRequireMobileVerified,
          platformFeeEnabled: !!data?.platformFeeEnabled,
          platformFeePercent: typeof data?.platformFeePercent === 'number' ? data.platformFeePercent : undefined,
          gstPercent: typeof data?.gstPercent === 'number' ? data.gstPercent : undefined,
          paymentUpiId: data?.paymentUpiId || 'trendstarzin@kotak',
          submissionApprovalWaitHours: typeof data?.submissionApprovalWaitHours === 'number' ? data.submissionApprovalWaitHours : 24,
          submissionAutoCompleteGraceHours: typeof data?.submissionAutoCompleteGraceHours === 'number' ? data.submissionAutoCompleteGraceHours : 48,
          payoutReleaseWaitHours: typeof data?.payoutReleaseWaitHours === 'number' ? data.payoutReleaseWaitHours : 24,
          otpVerificationEnabled: !!data?.otpVerificationEnabled,
          showSearchLink: data?.showSearchLink !== false,
          showRegisterInfluencerLink: data?.showRegisterInfluencerLink !== false,
          showRegisterBrandLink: data?.showRegisterBrandLink !== false,
          showRegisterPhotographerLink: data?.showRegisterPhotographerLink !== false,
        };
      }),
      catchError(() => of({
        preApproveInfluencers: false, influencerRequireEmailVerified: true, influencerRequireMobileVerified: false,
        preApproveBrands: false, brandRequireEmailVerified: true, brandRequireMobileVerified: false,
        platformFeeEnabled: false, platformFeePercent: undefined, gstPercent: undefined, paymentUpiId: 'trendstarzin@kotak',
        submissionApprovalWaitHours: 24,
        submissionAutoCompleteGraceHours: 48,
        payoutReleaseWaitHours: 24,
        otpVerificationEnabled: false,
        showSearchLink: true,
        showRegisterInfluencerLink: true,
        showRegisterBrandLink: true,
        showRegisterPhotographerLink: true,
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

  getCategories(role?: 'influencer' | 'brand' | 'photographer' | 'both'): Observable<any[]> {
    const qs = role ? `?role=${encodeURIComponent(role)}` : '';
    return this.http.get<any>(`${this.apiUrl}/categories${qs}`).pipe(
      map((res) => this.filterVisible(this.extractData<any[]>(res) || []))
    );
  }

  getPhotographerCategories(): Observable<string[]> {
    return this.getCategories('photographer').pipe(
      switchMap((categories: any[]) => {
        const strict = (Array.isArray(categories) ? categories : [])
          .filter((c: any) => {
            const role = String(c?.role || '').toLowerCase();
            return role === 'photographer' || role === 'both';
          })
          .map((c: any) => String(c?.name || '').trim())
          .filter((n: string) => !!n);

        if (strict.length) {
          return of(strict);
        }

        return this.getConfig().pipe(
          map((cfg: any) => (Array.isArray(cfg?.categories) ? cfg.categories : [])
            .filter((c: any) => {
              const role = String(c?.role || '').toLowerCase();
              return (role === 'photographer' || role === 'both') && c?.visible !== false;
            })
            .map((c: any) => String(c?.name || '').trim())
            .filter((n: string) => !!n),
          ),
          catchError(() => of([])),
        );
      }),
      catchError(() =>
        this.getConfig().pipe(
          map((cfg: any) => (Array.isArray(cfg?.categories) ? cfg.categories : [])
            .filter((c: any) => {
              const role = String(c?.role || '').toLowerCase();
              return (role === 'photographer' || role === 'both') && c?.visible !== false;
            })
            .map((c: any) => String(c?.name || '').trim())
            .filter((n: string) => !!n),
          ),
          catchError(() => of([])),
        ),
      ),
    );
  }

  getConfig(): Observable<any> {
    return this.http.get('/assets/admin-config.json').pipe(
      catchError(() => this.http.get('assets/admin-config.json')) // fallback for some setups
    );
  }

  getUserTagOptions(): Observable<{
    influencer: string[];
    brand: string[];
    photographer: string[];
    commission: string[];
  }> {
    const fallback = buildDefaultUserTagOptions();

    const normalize = (list: unknown, defaults: string[]) => {
      if (!Array.isArray(list)) return defaults;
      return list
        .map((item: any) => {
          if (typeof item === 'string') {
            return item.trim();
          }
          if (item && typeof item === 'object') {
            if (item.visible === false) return '';
            return String(item.name || '').trim();
          }
          return '';
        })
        .filter((v: string) => !!v);
    };

    return this.http.get<any>(`${this.apiUrl}/user-tag-options`).pipe(
      map((res: any) => {
        const data = this.extractData<any>(res) || res || {};
        return {
          influencer: normalize(data.influencer, fallback.influencer),
          brand: normalize(data.brand, fallback.brand),
          photographer: normalize(data.photographer, fallback.photographer),
          commission: normalize(data.commission, fallback.commission),
        };
      }),
      catchError(() =>
        this.getConfig().pipe(
          map((cfg: any) => {
            const fromConfig = cfg?.userTags || {};
            return {
              influencer: normalize(fromConfig.influencer, fallback.influencer),
              brand: normalize(fromConfig.brand, fallback.brand),
              photographer: normalize(fromConfig.photographer, fallback.photographer),
              commission: normalize(fromConfig.commission, fallback.commission),
            };
          }),
          catchError(() => of(buildDefaultUserTagOptions())),
        ),
      ),
    );
  }

  getSampleUsers(): Observable<any[]> {
    return this.http.get<any[]>('/assets/sample-users.json').pipe(
      catchError(() => this.http.get<any[]>('assets/sample-users.json'))
    );
  }

  getStates(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/states`).pipe(
      map((res) => this.filterVisible(this.extractData<any[]>(res) || []))
    );
  }

  getDistricts(stateName?: string, stateId?: string): Observable<any[]> {
    let url = `${this.apiUrl}/districts`;
    const params: string[] = [];
    if (stateName) params.push(`state=${encodeURIComponent(stateName)}`);
    if (stateId) params.push(`stateId=${encodeURIComponent(stateId)}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.http.get<any>(url).pipe(
      map((res) => this.filterVisible(this.extractData<any[]>(res) || []))
    );
  }

  getLanguages(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/languages`).pipe(
      map((res) => this.filterVisible(this.extractData<any[]>(res) || []))
    );
  }

  getTiers(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/tiers`).pipe(
      map((res) => this.filterVisible(this.extractData<any[]>(res) || []))
    );
  }

  getSocialMedia(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/social-media`).pipe(
      map((res) => this.filterVisible(this.extractData<any[]>(res) || []))
    );
  }

  getCollaborationAvailabilityOptions(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/collaboration-availability-options`).pipe(
      map((res) => this.extractData<any>(res) || res || {})
    );
  }

  getCreatorTypeOptions(): Observable<any[]> {
    const normalize = (items: unknown) => (Array.isArray(items) ? items : [])
      .map((item: any) => {
        if (typeof item === 'string') return { name: item.trim(), visible: true };
        return {
          ...item,
          name: String(item?.name || '').trim(),
          visible: item?.visible !== false,
        };
      })
      .filter((item: any) => !!item.name && item.visible !== false);

    return this.http.get<any>(`${this.apiUrl}/creator-type-options`).pipe(
      map((res) => normalize(this.extractData<any[]>(res) || res || [])),
      catchError(() =>
        this.getConfig().pipe(
          map((cfg: any) => normalize(cfg?.creatorTypeOptions)),
          catchError(() => of([])),
        ),
      ),
    );
  }

  getEquipmentOptions(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/equipment-options`).pipe(
      map((res) => this.extractData<any[]>(res) || []),
      switchMap((items: any[]) => {
        if (items.length) {
          return of(items);
        }
        return this.getConfig().pipe(
          map((cfg: any) => (Array.isArray(cfg?.equipmentOptions) ? cfg.equipmentOptions : [])
            .filter((e: any) => e?.visible !== false)
          ),
          catchError(() => of([])),
        );
      }),
      catchError(() =>
        this.getConfig().pipe(
          map((cfg: any) => (Array.isArray(cfg?.equipmentOptions) ? cfg.equipmentOptions : [])
            .filter((e: any) => e?.visible !== false)
          ),
          catchError(() => of([])),
        ),
      ),
    );
  }

  getPricingOptions(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/pricing-options`).pipe(
      map((res) => this.extractData<any[]>(res) || []),
      switchMap((items: any[]) => {
        if (items.length) {
          return of(items);
        }
        return this.getConfig().pipe(
          map((cfg: any) => (Array.isArray(cfg?.pricingOptions) ? cfg.pricingOptions : [])
            .filter((p: any) => p?.visible !== false)
          ),
          catchError(() => of([])),
        );
      }),
      catchError(() =>
        this.getConfig().pipe(
          map((cfg: any) => (Array.isArray(cfg?.pricingOptions) ? cfg.pricingOptions : [])
            .filter((p: any) => p?.visible !== false)
          ),
          catchError(() => of([])),
        ),
      ),
    );
  }

  private extractData<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data as T;
    }
    return payload as T;
  }

  private filterVisible<T extends { showInFrontend?: boolean }>(items: T[]): T[] {
    return (Array.isArray(items) ? items : []).filter((item: T) => item?.showInFrontend !== false);
  }

  getInfluencersSearchResponse(options?: {
    page?: number;
    limit?: number;
    lite?: boolean;
    state?: string;
    district?: string;
    viewerState?: string;
    viewerDistrict?: string;
    smartLocationPriority?: boolean;
    countSearch?: boolean;
    countReason?: 'query' | 'filter' | 'pagination';
    creatorType?: string;
  }): Observable<any> {
    const params: string[] = [];
    if (typeof options?.page === 'number') params.push(`page=${encodeURIComponent(String(options.page))}`);
    if (typeof options?.limit === 'number') params.push(`limit=${encodeURIComponent(String(options.limit))}`);
    if (typeof options?.lite === 'boolean') params.push(`lite=${options.lite ? '1' : '0'}`);
    if (options?.state) params.push(`state=${encodeURIComponent(options.state)}`);
    if (options?.district) params.push(`district=${encodeURIComponent(options.district)}`);
    if (options?.creatorType) params.push(`creatorType=${encodeURIComponent(options.creatorType)}`);
    if (options?.viewerState) params.push(`viewerState=${encodeURIComponent(options.viewerState)}`);
    if (options?.viewerDistrict) params.push(`viewerDistrict=${encodeURIComponent(options.viewerDistrict)}`);
    if (typeof options?.smartLocationPriority === 'boolean') {
      params.push(`smartLocationPriority=${options.smartLocationPriority ? '1' : '0'}`);
    }
    if (typeof options?.countSearch === 'boolean') {
      params.push(`countSearch=${options.countSearch ? '1' : '0'}`);
    }
    if (options?.countReason) {
      params.push(`countReason=${encodeURIComponent(options.countReason)}`);
    }
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<any>(`${this.apiUrl}/users/influencers${qs}`).pipe(
      map((res) => this.extractData<any>(res) || res || {})
    );
  }

  getInfluencers(options?: {
    page?: number;
    limit?: number;
    lite?: boolean;
    state?: string;
    district?: string;
    viewerState?: string;
    viewerDistrict?: string;
    smartLocationPriority?: boolean;
    countSearch?: boolean;
    countReason?: 'query' | 'filter' | 'pagination';
    creatorType?: string;
  }): Observable<any[]> {
    return this.getInfluencersSearchResponse(options).pipe(
      map((data) => (data?.data || data || []) as any[]),
      catchError(() => of([]))
    );
  }

  getBrands(options?: { page?: number; limit?: number; lite?: boolean }): Observable<any[]> {
    const params: string[] = [];
    if (typeof options?.page === 'number') params.push(`page=${encodeURIComponent(String(options.page))}`);
    if (typeof options?.limit === 'number') params.push(`limit=${encodeURIComponent(String(options.limit))}`);
    if (typeof options?.lite === 'boolean') params.push(`lite=${options.lite ? '1' : '0'}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<any>(`${this.apiUrl}/users/brands${qs}`).pipe(
      map((res) => {
        const data = this.extractData<any>(res);
        return (data?.data || data || []) as any[];
      }),
      catchError(() => of([]))
    );
  }

  getPhotographers(options?: {
    page?: number;
    limit?: number;
    skill?: string;
    location?: string;
    keyword?: string;
    viewerState?: string;
    viewerDistrict?: string;
    smartLocationPriority?: boolean;
    countSearch?: boolean;
    countReason?: 'query' | 'filter' | 'pagination';
  }): Observable<any[]> {
    return this.getPhotographersSearchResponse(options).pipe(
      map((data) => (Array.isArray(data) ? data : (data?.data || [])) as any[]),
      catchError(() => of([]))
    );
  }

  getPhotographersSearchResponse(options?: {
    page?: number;
    limit?: number;
    skill?: string;
    location?: string;
    keyword?: string;
    viewerState?: string;
    viewerDistrict?: string;
    smartLocationPriority?: boolean;
    countSearch?: boolean;
    countReason?: 'query' | 'filter' | 'pagination';
  }): Observable<any> {
    const params: string[] = [];
    if (typeof options?.page === 'number') params.push(`page=${encodeURIComponent(String(options.page))}`);
    if (typeof options?.limit === 'number') params.push(`limit=${encodeURIComponent(String(options.limit))}`);
    if (options?.skill) params.push(`skill=${encodeURIComponent(options.skill)}`);
    if (options?.location) params.push(`location=${encodeURIComponent(options.location)}`);
    if (options?.keyword) params.push(`keyword=${encodeURIComponent(options.keyword)}`);
    if (options?.viewerState) params.push(`viewerState=${encodeURIComponent(options.viewerState)}`);
    if (options?.viewerDistrict) params.push(`viewerDistrict=${encodeURIComponent(options.viewerDistrict)}`);
    if (typeof options?.smartLocationPriority === 'boolean') {
      params.push(`smartLocationPriority=${options.smartLocationPriority ? '1' : '0'}`);
    }
    if (typeof options?.countSearch === 'boolean') {
      params.push(`countSearch=${options.countSearch ? '1' : '0'}`);
    }
    if (options?.countReason) {
      params.push(`countReason=${encodeURIComponent(options.countReason)}`);
    }
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<any>(`${this.apiUrl}/users/photographers${qs}`).pipe(
      map((res) => this.extractData<any>(res) || res || {})
    );
  }

  getPhotographerById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/photographers/${encodeURIComponent(id)}`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError(() => of(null))
    );
  }

  getPhotographerByUsername(username: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/photographers/username/${encodeURIComponent(username)}`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError(() => of(null))
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

  getPhotographerProfileById(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/photographers/me/profile`).pipe(
      map((res) => this.extractData<any>(res)),
      catchError((err) => {
        console.error('Error fetching photographer profile:', err);
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
  /** Fetch all campaigns (optionally filter by status/scope) — used for influencer browse view */
  getAllCampaigns(status?: string, scope?: 'campaign' | 'collaboration'): Observable<any[]> {
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (scope) params.push(`scope=${encodeURIComponent(scope)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return this.http.get<any>(`${this.apiUrl}/campaigns${qs}`).pipe(
      map(res => {
        const d = this.extractData<any>(res);
        return (Array.isArray(d) ? d : d?.data ?? []) as any[];
      }),
      catchError(() => of([]))
    );
  }

  getCampaignById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/campaigns/${id}`).pipe(
      map(res => this.extractData<any>(res) || res),
      catchError(() => of(null))
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
    return this.http.post(`${this.apiUrl}/campaigns`, data).pipe(
      map((res: any) => this.extractData<any>(res))
    );
  }

  updateCampaign(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaigns/${id}`, data).pipe(
      map((res: any) => this.extractData<any>(res))
    );
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

  getMyNotifications(limit = 20): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/notifications?limit=${limit}`).pipe(
      map((res) => this.extractData<any[]>(res) || []),
      catchError(() => of([])),
    );
  }

  getUnreadNotificationsCount(): Observable<number> {
    return this.http.get<any>(`${this.apiUrl}/notifications/unread-count`).pipe(
      map((res) => Number(res?.count || 0)),
      catchError(() => of(0)),
    );
  }

  markNotificationRead(notificationId: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/notifications/${notificationId}/read`, {});
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/mark-all-read`, {});
  }

  submitCampaignPaymentProof(campaignId: string, data: { utrNumber: string; paymentProofUrl?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-transactions/${campaignId}/submit-proof`, data);
  }

  getCampaignTransactionStatus(campaignId: string): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-transactions/campaign/${campaignId}/status`).pipe(
      map(res => {
        const d = this.extractData<any>(res);
        if (Array.isArray(d)) return d;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      }),
      catchError(() => of([]))
    );
  }

  deleteCampaign(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/campaigns/${id}`);
  }

  // ── Campaign Invite endpoints ───────────────
  createCampaignInvite(data: { campaignId: string; influencerId: string; recipientRole?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaign-invites`, data);
  }

  invitePhotographers(campaignId: string, photographerIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/campaigns/${campaignId}/invite-photographers`, { photographerIds });
  }

  getInviteWithCampaign(inviteId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/${inviteId}`).pipe(
      map((res) => this.extractData<any>(res) || res),
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

  getMyInvites(scope?: 'campaign' | 'collaboration'): Observable<any[]> {
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/influencer${qs}`).pipe(
      map(res => { const d = this.extractData<any>(res); return Array.isArray(d) ? d : (d?.data ?? []); }),
      catchError(() => of([]))
    );
  }

  getMyPhotographerInvites(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/campaign-invites/photographer`).pipe(
      map(res => { const d = this.extractData<any>(res); return Array.isArray(d) ? d : (d?.data ?? []); }),
      catchError(() => of([]))
    );
  }

  applyToOpenCampaign(campaignId: string, selectedPlatform?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/campaign-invites/campaign/${campaignId}/apply`, { selectedPlatform: selectedPlatform ?? null }).pipe(
      map(res => this.extractData<any>(res) || res)
    );
  }

  respondToInvite(
    inviteId: string,
    status: 'accepted' | 'declined' | 'counter_sent',
    selectedPostDate?: string,
    selectedPlatform?: string,
    selectedContentType?: string,
    counterAmount?: number,
    counterMessage?: string,
    payout?: { upiId?: string; mobile?: string; accountHolderName?: string },
    shippingAddress?: {
      contactName?: string; contactMobile?: string;
      line1?: string; line2?: string;
      city?: string; state?: string; pincode?: string; landmark?: string;
    },
  ): Observable<any> {
    const body: any = { status };
    if (selectedPostDate) body.selectedPostDate = selectedPostDate;
    if (selectedPlatform) body.selectedPlatform = selectedPlatform;
    if (selectedContentType) body.selectedContentType = selectedContentType;
    if (counterAmount && counterAmount > 0) body.counterAmount = counterAmount;
    if (counterMessage) body.counterMessage = counterMessage;
    if (payout && (payout.upiId || payout.mobile || payout.accountHolderName)) {
      body.payout = payout;
    }
    if (shippingAddress && (shippingAddress.line1 || shippingAddress.pincode)) {
      body.shippingAddress = shippingAddress;
    }
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/respond`, body);
  }

  respondToCounterOffer(
    inviteId: string,
    action: 'accept' | 'decline' | 'counter',
    counterAmount?: number,
    note?: string,
  ): Observable<any> {
    const body: any = { action };
    if (counterAmount && counterAmount > 0) body.counterAmount = counterAmount;
    if (note) body.note = note;
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/counter/respond`, body);
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
  startInviteWork(inviteId: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/campaign-invites/${inviteId}/start-work`, {});
  }

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
