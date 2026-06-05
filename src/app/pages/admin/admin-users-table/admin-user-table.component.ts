import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../shared/config.service';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AdminConfirmDialogComponent } from '../../../shared/admin-confirm-dialog/admin-confirm-dialog.component';
import { buildDefaultUserTagOptions } from '../../../shared/constants/user-tag-options.constants';
import { buildSocialProfileUrl, normalizeSocialHandle } from '../../../shared/social-handle.util';
import { TIER_DESC_MAP } from '../../../shared/tiers.constants';

@Component({
  selector: 'app-admin-user-table',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminConfirmDialogComponent],
  templateUrl: './admin-user-table.component.html',
  styleUrls: ['./admin-user-table.component.scss']
})
export class AdminUserTableComponent implements OnInit {
  filtersExpanded = true;
  searchQuery = '';
  currentPage = 1;
  pageSize = 100;
  readonly pageSizeOptions = [25, 50, 100, 250, 500, 1000];

  showUserDetailsModal = false;
  selectedUser: any = null;
  selectedUserType: 'influencer' | 'brand' | 'photographer' | null = null;
  selectedUserInternalNotes = '';

  private readonly defaultUserTagOptions = buildDefaultUserTagOptions();
  influencerBadgeOptions = [...this.defaultUserTagOptions.influencer];
  brandBadgeOptions = [...this.defaultUserTagOptions.brand];
  photographerBadgeOptions = [...this.defaultUserTagOptions.photographer];
  commissionBadgeOptions = [...this.defaultUserTagOptions.commission];
  readonly verificationStatusOptions = ['not_submitted', 'pending', 'approved', 'rejected', 'removed'];
  verificationNotesDraft: Record<string, string> = {};

    public getPremiumDurationLabel(duration: string | undefined): string {
      switch (duration) {
        case '1m':
          return '1 Month';
        case '3m':
          return '3 Months';
        case '1y':
          return '1 Year';
        default:
          return '';
      }
    }
  // Confirmation dialog state
  confirmDialogOpen = false;
  confirmDialogMessage = '';
  confirmDialogAction: (() => void) | null = null;

  showConfirm(message: string, action: () => void) {
    this.confirmDialogMessage = message;
    this.confirmDialogAction = action;
    this.confirmDialogOpen = true;
  }

  onConfirmDialogConfirm() {
    if (this.confirmDialogAction) this.confirmDialogAction();
    this.confirmDialogOpen = false;
    this.confirmDialogAction = null;
  }

  onConfirmDialogCancel() {
    this.confirmDialogOpen = false;
    this.confirmDialogAction = null;
  }
  private readonly handleUserRestoredRefresh = () => {
    this.fetchUsers();
  };

  getProfileImage(user: any): string {
    if (!user.profileImages || !user.profileImages.length) return 'assets/default-profile.png';
    const img = user.profileImages[0];
    if (img && typeof img === 'object' && img.url) return img.url;
    if (typeof img === 'string' && img) return img;
    return 'assets/default-profile.png';
  }

  getBrandLogo(user: any): string {
    if (!user.brandLogo || !user.brandLogo.length) return 'assets/default-profile-brands.png';
    const img = user.brandLogo[0];
    if (img && typeof img === 'object' && img.url) return img.url;
    if (typeof img === 'string' && img) return img;
    return 'assets/default-profile-brands.png';
  }

  getUserAvatar(user: any, userType: 'influencer' | 'brand' | 'photographer'): string {
    return userType === 'brand' ? this.getBrandLogo(user) : this.getProfileImage(user);
  }

  getUserDisplayName(user: any): string {
    return user?.brandName || user?.name || '-';
  }

  getUserHandle(user: any): string {
    const handle = user?.username || user?.brandUsername || user?.userName || user?.brand_username;
    return handle ? `@${handle}` : '-';
  }

  getUserStatusKey(user: any): 'accepted' | 'pending' | 'rejected' | 'deleted' | 'other' {
    if (user?.isDeleted === true || String(user?.isDeleted || '').toLowerCase() === 'true') return 'deleted';
    const status = String(user?.status || '').trim().toLowerCase();
    if (['accepted', 'approved', 'active'].includes(status)) return 'accepted';
    if (['pending', 'pending_verification', 'pending_review', 'new'].includes(status)) return 'pending';
    if (['rejected', 'declined', 'blocked', 'suspended'].includes(status)) return 'rejected';
    return 'other';
  }

  getUserStatusLabel(user: any): string {
    const key = this.getUserStatusKey(user);
    if (key === 'accepted') return 'Accepted';
    if (key === 'pending') return 'Pending';
    if (key === 'rejected') return 'Rejected';
    if (key === 'deleted') return 'Deleted';
    const raw = String(user?.status || '').trim();
    return raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Unknown';
  }

  getUserStatusBadgeClass(user: any): string {
    return `status-${this.getUserStatusKey(user)}`;
  }

  getUserStatusRowClass(user: any): string {
    return `user-row--${this.getUserStatusKey(user)}`;
  }

  getUserCategoryList(user: any): string[] {
    if (Array.isArray(user?.categories) && user.categories.length) return user.categories;
    if (Array.isArray(user?.skills) && user.skills.length) return user.skills;
    return [];
  }

  getUserCreatorTypesLabel(user: any): string {
    const values = Array.isArray(user?.creatorTypes) ? user.creatorTypes : [];
    const cleaned = values.map((item: any) => String(item || '').trim()).filter((item: string) => !!item);
    return cleaned.length ? cleaned.join(', ') : '-';
  }

  getUserCollaborationAvailabilityLabel(user: any): string {
    const collab = user?.collaborationAvailability || {};
    if (!collab || collab.enabled === false) return '-';
    const parts: string[] = [];
    if (Array.isArray(collab.collaborationTypes) && collab.collaborationTypes.length) {
      parts.push(`Types: ${collab.collaborationTypes.join(', ')}`);
    }
    if (collab.preference) {
      parts.push(`Preference: ${collab.preference}`);
    }
    if (Array.isArray(collab.availableFor) && collab.availableFor.length) {
      parts.push(`Available for: ${collab.availableFor.join(', ')}`);
    }
    if (collab.openToTravel) {
      parts.push('Open to travel');
    }
    return parts.length ? parts.join(' | ') : 'Enabled';
  }

  getUserStateLabel(user: any): string {
    const district = user?.location?.district || '';
    const state = user?.location?.state || '';
    if (district && state) return `${district} | ${state}`;
    return district || state || '-';
  }

  getUserStartingPrice(user: any): string {
    const value = user?.promotionalPrice ?? user?.price ?? user?.pricing?.startingFrom;
    if (value === null || value === undefined || value === '') return '-';
    return `Rs ${value} / post`;
  }

  getUserSocialRateGroups(user: any): Array<{ platform: string; items: Array<{ name: string; price: number }> }> {
    const rows = Array.isArray(user?.socialMedia) ? user.socialMedia : [];
    return rows
      .map((sm: any) => {
        const platform = this.getSocialLabel(this.resolveSocialPlatform(sm));
        const items = (Array.isArray(sm?.contentTypes) ? sm.contentTypes : [])
          .filter((ct: any) => this.isEnabledPricedItem(ct))
          .map((ct: any) => ({
            name: String(ct?.name || ct?.label || '').trim(),
            price: Number(ct?.price) || 0,
          }))
          .filter((item: any) => item.name && item.price > 0);
        return { platform, items };
      })
      .filter((group: any) => group.items.length > 0);
  }

  getUserServiceRates(user: any): Array<{ name: string; price: number }> {
    const pricing = Array.isArray(user?.pricing) ? user.pricing : [];
    return pricing
      .filter((item: any) => this.isEnabledPricedItem(item))
      .map((item: any) => ({
        name: String(item?.name || item?.key || item?.label || '').trim(),
        price: Number(item?.price) || 0,
      }))
      .filter((item: any) => item.name && item.price > 0);
  }

  hasUserRateDetails(user: any): boolean {
    return this.getUserSocialRateGroups(user).length > 0 || this.getUserServiceRates(user).length > 0;
  }

  private isEnabledPricedItem(item: any): boolean {
    const price = Number(item?.price);
    if (!Number.isFinite(price) || price <= 0) return false;
    if ('enabled' in item) return item.enabled === true;
    if ('selected' in item) return item.selected === true;
    return false;
  }

  private parseCountValue(value: any): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.]/g, '');
      if (!cleaned) return 0;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  getUserLanguages(user: any): string {
    if (!Array.isArray(user?.languages) || !user.languages.length) return '-';
    return user.languages.join(', ');
  }

  getUserCategoriesLabel(user: any): string {
    const list = this.getUserCategoryList(user);
    return list.length ? list.join(', ') : '-';
  }

  getUserProfileTraffic(user: any): { impressions: number; clicks: number } {
    return {
      impressions: Number(user?.profileTraffic?.impressions ?? 0),
      clicks: Number(user?.profileTraffic?.clicks ?? 0),
    };
  }

  getUserVerificationStatus(user: any): string {
    return String(user?.verificationStatus || 'not_submitted');
  }

  hasVerificationDocuments(user: any): boolean {
    return Array.isArray(user?.verificationDocuments) && user.verificationDocuments.length > 0;
  }

  getUserPaymentMethodLabel(user: any): string {
    const method = String(user?.latestPayment?.paymentMethod || '').toLowerCase();
    if (method === 'upi') return 'UPI';
    if (method === 'qr') return 'QR Code';
    if (user?.isPremium && (!method || method === 'admin')) {
      const duration = this.getPremiumDurationLabel(user?.premiumDuration);
      return duration ? `Admin Granted (${duration})` : 'Admin Granted';
    }
    return '-';
  }

  getUserPremiumLabel(user: any): string {
    if (!user?.isPremium) return 'Free';
    const period = this.getPremiumPeriod(user);
    if (period?.end) return `Premium till ${period.end.toLocaleDateString('en-IN')}`;
    return 'Premium';
  }

  getSocialMediaItems(user: any): Array<{ href: string; icon: string; label: string; handle: string; followers: number; shortLabel: string; tierLabel: string }> {
    if (!Array.isArray(user?.socialMedia)) return [];
    return user.socialMedia
      .map((sm: any) => {
        const platform = this.resolveSocialPlatform(sm);
        const href = this.resolveSocialHref(sm, platform);
        const followers = this.parseCountValue(sm?.followersCount);
        if (!href) return null;
        const rawHandle = normalizeSocialHandle(sm?.handle, platform);
        const label = this.getSocialLabel(platform);
        return {
          href,
          icon: this.getSocialIcon(platform),
          label,
          shortLabel: this.getSocialShortLabel(platform),
          handle: rawHandle ? `@${rawHandle}` : '-',
          followers,
          tierLabel: this.getSocialTierLabel(sm),
        };
      })
        .filter((item: any): item is { href: string; icon: string; label: string; handle: string; followers: number; shortLabel: string; tierLabel: string } => !!item);
  }

  getTableSocialMediaItems(user: any): Array<{ href: string; icon: string; label: string; handle: string; followers: number; shortLabel: string; tierLabel: string }> {
    return this.getSocialMediaItems(user).slice(0, 3);
  }

  getTierValue(user: any): 'premium' | 'free' {
    return user?.isPremium ? 'premium' : 'free';
  }

  onTierSelectChange(
    user: any,
    userType: 'influencer' | 'brand' | 'photographer',
    value: 'premium' | 'free' | string,
  ): void {
    if (!user?._id) return;
    const normalized = value === 'premium' ? 'premium' : 'free';
    if (normalized === 'premium' && !user.isPremium) {
      this.openPremiumModal(user._id, userType);
      return;
    }
    if (normalized === 'free' && user.isPremium) {
      this.setPremium(user._id, false, userType);
    }
  }

  private resolveSocialPlatform(sm: any): string {
    const explicit = String(sm?.platform || sm?.type || sm?.channel || '').toLowerCase();
    const link = String(sm?.url || '').toLowerCase();
    if (explicit.includes('insta') || link.includes('instagram.com')) return 'instagram';
    if (explicit.includes('youtube') || link.includes('youtube.com') || link.includes('youtu.be')) return 'youtube';
    if (explicit.includes('facebook') || link.includes('facebook.com')) return 'facebook';
    if (explicit.includes('twitter') || explicit === 'x' || link.includes('x.com') || link.includes('twitter.com')) return 'x';
    if (explicit.includes('linkedin') || link.includes('linkedin.com')) return 'linkedin';
    return 'social';
  }

  private resolveSocialHref(sm: any, platform: string): string {
    const rawUrl = String(sm?.url || '').trim();
    if (rawUrl) {
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
      return `https://${rawUrl}`;
    }
    return buildSocialProfileUrl(platform, sm?.handle);
  }

  private getSocialTierLabel(sm: any): string {
    const tier = String(sm?.tier || '').trim();
    if (!tier) return '';
    const desc = String(sm?.tierDesc || sm?.desc || TIER_DESC_MAP[tier.toLowerCase()] || '').trim();
    return desc ? `${tier} (${desc})` : tier;
  }

  private getSocialIcon(platform: string): string {
    if (platform === 'instagram') return 'bi-instagram';
    if (platform === 'youtube') return 'bi-youtube';
    if (platform === 'facebook') return 'bi-facebook';
    if (platform === 'x') return 'bi-twitter-x';
    if (platform === 'linkedin') return 'bi-linkedin';
    return 'bi-link-45deg';
  }

  private getSocialLabel(platform: string): string {
    if (platform === 'instagram') return 'Instagram';
    if (platform === 'youtube') return 'YouTube';
    if (platform === 'facebook') return 'Facebook';
    if (platform === 'x') return 'X';
    if (platform === 'linkedin') return 'LinkedIn';
    return 'Social';
  }

  private getSocialShortLabel(platform: string): string {
    if (platform === 'instagram') return 'IG';
    if (platform === 'youtube') return 'YT';
    if (platform === 'facebook') return 'FB';
    if (platform === 'x') return 'X';
    if (platform === 'linkedin') return 'IN';
    return 'SM';
  }

  getRoleTitle(): string {
    if (this.activeTab === 'influencer') return 'Influencers';
    if (this.activeTab === 'brand') return 'Brands';
    return 'Photo/Videographers';
  }

  getSignupSource(user: any): string {
    const source = user?.signupAttribution?.source;
    const audience = user?.signupAttribution?.audience;
    if (!source && !audience) return '-';
    if (source && audience) return `${source} (${audience})`;
    return source || audience || '-';
  }

  private getSignupSourceFilterValue(user: any): string {
    return user?.signupAttribution?.source || user?.signupAttribution?.audience || '';
  }
  // Helper to calculate premium end date for display if backend does not provide
  getPremiumPeriod(user: any): { start: Date, end: Date } | null {
    if (!user.isPremium) return null;
    // Prefer backend dates if present
    if (user.premiumStart && user.premiumEnd) {
      return { start: new Date(user.premiumStart), end: new Date(user.premiumEnd) };
    }
    // Fallback: calculate from acceptedAt and premiumDuration
    if (user.acceptedAt && user.premiumDuration) {
      const start = new Date(user.acceptedAt);
      let end = new Date(start);
      if (user.premiumDuration === '1m') end.setMonth(end.getMonth() + 1);
      else if (user.premiumDuration === '3m') end.setMonth(end.getMonth() + 3);
      else if (user.premiumDuration === '1y') end.setFullYear(end.getFullYear() + 1);
      return { start, end };
    }
    return null;
  }
  openPremiumModal(userId: string, userType: 'influencer' | 'brand' | 'photographer') {
      this.premiumUserId = userId;
      this.premiumDuration = '';
      this.premiumIsPremium = true;
      this.premiumType = userType;
      this.showPremiumModal = true;
      // debug: open premium modal
    }
  activeTab: 'influencer' | 'brand' | 'photographer' = 'influencer'; // Default to influencer tab
  influencers: any[] = [];
  brands: any[] = [];
  photographers: any[] = [];
  filteredInfluencers: any[] = [];
  filteredBrands: any[] = [];
  filteredPhotographers: any[] = [];

  // Filter properties
  influencerFilters = {
    status: '',
    premium: '',
    category: '',
    state: '',
    signupSource: '',
    badgeTag: '',
    emailVerified: '',
    mobileVerified: ''
  };
  brandFilters = {
    status: '',
    premium: '',
    category: '',
    state: '',
    signupSource: '',
    badgeTag: '',
    emailVerified: '',
    mobileVerified: ''
  };
  photographerFilters = {
    status: '',
    premium: '',
    category: '',
    state: '',
    signupSource: '',
    badgeTag: '',
    emailVerified: '',
    mobileVerified: ''
  };

  // Available filter options
  categoriesArray: string[] = [];
  statesArray: string[] = [];
  statusArray: string[] = [];
  signupSourcesArray: string[] = [];

  // Premium modal state
  showPremiumModal = false;
  premiumUserId: string | null = null;
  premiumDuration: '1m' | '3m' | '1y' | '' = '';
  premiumIsPremium = true;
  premiumType: 'influencer' | 'brand' | 'photographer' | null = null;

  // Badge/tag modal state
  showTagModal = false;
  tagUserId: string | null = null;
  tagType: 'influencer' | 'brand' | 'photographer' | null = null;
  selectedTagOptions: string[] = [];

  // Verification docs modal state
  showVerificationDocsModal = false;
  verificationDocsUser: any = null;
  verificationDocsUserType: 'influencer' | 'brand' | 'photographer' | null = null;
  verificationDocsDraft = '';

  // Holds an error message when profile/registration fetch fails
  registrationError: string | null = null;
  firebaseImportMessage = '';
  isImportingFirebaseUsers = false;

  isLoading: boolean = false;

  constructor(private http: HttpClient, private configService: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.filtersExpanded = window.innerWidth >= 768;
    }
    this.fetchUsers();
    if (typeof window !== 'undefined') {
      window.addEventListener('user-restored-refresh', this.handleUserRestoredRefresh);
    }
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : null;
    // debug: profile token
    if (token) {
      this.configService.getInfluencerProfileById().subscribe({
        next: (profile) => {
          // debug: fetched profile
          // ...existing code...
        },
        error: (err) => {
          console.error('Profile fetch error:', err);
          this.registrationError = 'Error fetching profile.';
        }
      });
    }

    this.configService.getUserTagOptions().subscribe((options) => {
      this.influencerBadgeOptions = options.influencer?.length
        ? options.influencer
        : this.influencerBadgeOptions;
      this.brandBadgeOptions = options.brand?.length
        ? options.brand
        : this.brandBadgeOptions;
      this.photographerBadgeOptions = options.photographer?.length
        ? options.photographer
        : this.photographerBadgeOptions;
      this.commissionBadgeOptions = options.commission?.length
        ? options.commission
        : this.commissionBadgeOptions;
      this.cd.detectChanges();
    });
  }

  toggleFilters() {
    this.filtersExpanded = !this.filtersExpanded;
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('user-restored-refresh', this.handleUserRestoredRefresh);
    }
  }


  fetchUsers() {
    this.isLoading = true;
    const headers = this.getAuthHeaders();
    const adminListParams = `limit=1000`;
    const statusParam = this.isDeletedTab() ? 'status=deleted&' : '';
    const influencerUrl = `${environment.apiBaseUrl}/admin/influencers?${statusParam}${adminListParams}`;
    this.http.get<any>(influencerUrl, headers)
      .pipe(timeout(5000), catchError(() => of([])))
      .subscribe((res: any) => {
        const users = Array.isArray(res) ? res : (res?.data || []);
        this.influencers = users;
        this.applyFilters('influencer');
        this.updateAllFilterOptions();
        this.refreshSelectedUserFromLists();
        this.isLoading = false;
        this.cd.detectChanges();
      });

    const brandUrl = `${environment.apiBaseUrl}/admin/brands?${statusParam}${adminListParams}`;
    this.http.get<any>(brandUrl, headers)
      .pipe(timeout(5000), catchError(() => of([])))
      .subscribe((res: any) => {
        const users = Array.isArray(res) ? res : (res?.data || []);
        this.brands = users;
        this.applyFilters('brand');
        this.updateAllFilterOptions();
        this.refreshSelectedUserFromLists();
        this.isLoading = false;
        this.cd.detectChanges();
      });

    const photographerUrl = `${environment.apiBaseUrl}/admin/photographers?${statusParam}${adminListParams}`;
    this.http.get<any>(photographerUrl, headers)
      .pipe(timeout(5000), catchError(() => of([])))
      .subscribe((res: any) => {
        const users = Array.isArray(res) ? res : (res?.data || []);
        this.photographers = users;
        this.applyFilters('photographer');
        this.updateAllFilterOptions();
        this.refreshSelectedUserFromLists();
        this.isLoading = false;
        this.cd.detectChanges();
      });
  }

  importFirebaseUsers(): void {
    this.firebaseImportMessage = '';
    this.isImportingFirebaseUsers = true;
    this.http
      .post<any>(
        `${environment.apiBaseUrl}/admin/firebase/import-missing-users`,
        {},
        this.getAuthHeaders(),
      )
      .pipe(
        timeout(15000),
        catchError((err) => {
          const message = err?.error?.message || 'Firebase import failed.';
          return of({ success: false, imported: 0, skipped: 0, message });
        }),
      )
      .subscribe((result: any) => {
        this.isImportingFirebaseUsers = false;
        const imported = Number(result?.imported || 0);
        const skipped = Number(result?.skipped || 0);
        const byType = result?.byType || {};
        const importedSummary = [
          `${Number(byType.influencer || 0)} influencers`,
          `${Number(byType.brand || 0)} brands`,
          `${Number(byType.photographer || 0)} photo/videographers`,
        ].join(', ');
        this.firebaseImportMessage = result?.success
          ? `User import complete. Imported ${imported} (${importedSummary}), skipped ${skipped}.`
          : result?.message || 'Firebase import failed.';
        this.fetchUsers();
        this.cd.detectChanges();
      });
  }

  private getUsersByType(userType: 'influencer' | 'brand' | 'photographer'): any[] {
    if (userType === 'influencer') return this.influencers;
    if (userType === 'brand') return this.brands;
    return this.photographers;
  }

  private refreshSelectedUserFromLists(): void {
    if (!this.showUserDetailsModal || !this.selectedUser || !this.selectedUserType) return;
    const selectedId = String(this.selectedUser?._id || '');
    if (!selectedId) return;
    const latest = this.getUsersByType(this.selectedUserType).find((u: any) => String(u?._id || '') === selectedId);
    if (!latest) {
      this.closeUserDetailsModal();
      return;
    }
    this.selectedUser = latest;
    this.selectedUserInternalNotes = String(latest?.verificationAdminNotes || this.selectedUserInternalNotes || '');
  }

  updateAllFilterOptions() {
    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();
    const statusSet = new Set<string>();
    const signupSourceSet = new Set<string>();
    
    // Collect from all influencers
    this.influencers.forEach(user => {
      if (user.categories && Array.isArray(user.categories)) {
        user.categories.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
      if (user.status) {
        statusSet.add(user.status);
      }
      const signupSource = this.getSignupSourceFilterValue(user);
      if (signupSource) {
        signupSourceSet.add(signupSource);
      }
    });
    
    // Collect from all brands
    this.brands.forEach(user => {
      if (user.categories && Array.isArray(user.categories)) {
        user.categories.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
      if (user.status) {
        statusSet.add(user.status);
      }
      const signupSource = this.getSignupSourceFilterValue(user);
      if (signupSource) {
        signupSourceSet.add(signupSource);
      }
    });

    this.photographers.forEach(user => {
      if (user.skills && Array.isArray(user.skills)) {
        user.skills.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
      if (user.status) {
        statusSet.add(user.status);
      }
      const signupSource = this.getSignupSourceFilterValue(user);
      if (signupSource) {
        signupSourceSet.add(signupSource);
      }
    });
    
    this.categoriesArray = Array.from(categoriesSet).sort();
    this.statesArray = Array.from(statesSet).sort();
    this.statusArray = Array.from(statusSet).sort();
    this.signupSourcesArray = Array.from(signupSourceSet).sort();
  }

  private getUserSortTime(user: any): number {
    const directDate = user?.firstRegisteredAt || user?.createdAt || user?.updatedAt;
    const parsedDate = directDate ? new Date(directDate).getTime() : 0;
    if (Number.isFinite(parsedDate) && parsedDate > 0) return parsedDate;

    const objectId = String(user?._id || '');
    if (/^[a-fA-F0-9]{24}$/.test(objectId)) {
      return parseInt(objectId.slice(0, 8), 16) * 1000;
    }
    return 0;
  }

  private sortNewestUsers(users: any[]): any[] {
    return [...users].sort((a, b) => this.getUserSortTime(b) - this.getUserSortTime(a));
  }

  applyFilters(userType: 'influencer' | 'brand' | 'photographer') {
    const filters = userType === 'influencer'
      ? this.influencerFilters
      : userType === 'brand'
        ? this.brandFilters
        : this.photographerFilters;
    const source = userType === 'influencer'
      ? this.influencers
      : userType === 'brand'
        ? this.brands
        : this.photographers;
    // If on User Management tab, show only non-deleted users. If on Deleted Users tab, show only deleted users.
    let filtered = source;
    if (this.isDeletedTab()) {
      filtered = filtered.filter(user => user.isDeleted === true || user.isDeleted === 'true');
    } else {
      filtered = filtered.filter(user => !user.isDeleted || user.isDeleted === false || user.isDeleted === 'false');
    }
    if (userType === 'influencer') {
      this.filteredInfluencers = this.sortNewestUsers(filtered.filter(user => this.matchesFilters(user, filters)));
      // debug: filtered influencers updated
    } else {
      if (userType === 'brand') {
        this.filteredBrands = this.sortNewestUsers(filtered.filter(user => this.matchesFilters(user, filters)));
      } else {
        this.filteredPhotographers = this.sortNewestUsers(filtered.filter(user => this.matchesFilters(user, filters)));
      }
    }
  }

  // Returns true if the Deleted Users tab is active (adjust as needed for your routing)
  isDeletedTab(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const isDeleted = window.location.pathname.includes('deleted-users');
    // debug: deleted users tab active = isDeleted
    return isDeleted;
  }

  matchesFilters(user: any, filters: any): boolean {
    // Status filter: Only filter if a specific status is selected (not empty or 'All'), otherwise show all statuses
    if (filters.status && filters.status !== '' && filters.status !== 'All' && user.status !== filters.status) {
      return false;
    }
    
    // Email Verified filter
    if (filters.emailVerified === 'verified' && !user.isEmailVerified) {
      return false;
    }
    if (filters.emailVerified === 'not_verified' && user.isEmailVerified) {
      return false;
    }
    
    // Mobile Verified filter
    if (filters.mobileVerified === 'verified' && !user.isMobileVerified) {
      return false;
    }
    if (filters.mobileVerified === 'not_verified' && user.isMobileVerified) {
      return false;
    }
    
    // Premium filter
    if (filters.premium === 'premium' && !user.isPremium) {
      return false;
    }
    if (filters.premium === 'free' && user.isPremium) {
      return false;
    }
    
    // Category filter
    const categoryList = Array.isArray(user.categories)
      ? user.categories
      : Array.isArray(user.skills)
        ? user.skills
        : [];
    if (filters.category && !categoryList.includes(filters.category)) {
      return false;
    }
    
    // State filter
    if (filters.state && user.location?.state !== filters.state) {
      return false;
    }

    // Signup source filter
    if (
      filters.signupSource &&
      this.getSignupSourceFilterValue(user) !== filters.signupSource
    ) {
      return false;
    }

    if (filters.badgeTag && !this.getUserTags(user).includes(filters.badgeTag)) {
      return false;
    }
    
    return true;
  }

  onFilterChange(userType: 'influencer' | 'brand' | 'photographer') {
    this.applyFilters(userType);
    this.currentPage = 1;
  }

  onSearchQueryChange(): void {
    this.currentPage = 1;
  }

  private getFiltersForType(userType: 'influencer' | 'brand' | 'photographer') {
    if (userType === 'influencer') return this.influencerFilters;
    if (userType === 'brand') return this.brandFilters;
    return this.photographerFilters;
  }

  getActiveFilterValue(field: string): string {
    const filters = this.getFiltersForType(this.activeTab) as Record<string, string>;
    return filters[field] || '';
  }

  setActiveFilterValue(field: string, value: string): void {
    const filters = this.getFiltersForType(this.activeTab) as Record<string, string>;
    filters[field] = value;
    this.onFilterChange(this.activeTab);
  }

  getVerificationNotes(user: any): string {
    const key = String(user?._id || '');
    if (!key) return '';
    if (this.verificationNotesDraft[key] === undefined) {
      this.verificationNotesDraft[key] = String(user?.verificationAdminNotes || '');
    }
    return this.verificationNotesDraft[key];
  }

  isEmailVerified(user: any): boolean {
    return !!user?.isEmailVerified;
  }

  isMobileVerified(user: any): boolean {
    return !!user?.isMobileVerified;
  }

  updateContactVerification(
    user: any,
    userType: 'influencer' | 'brand' | 'photographer',
    field: 'isEmailVerified' | 'isMobileVerified',
    value: boolean,
  ): void {
    const userId = String(user?._id || '');
    if (!userId) return;
    const label = field === 'isEmailVerified' ? 'email' : 'mobile';
    this.showConfirm(`Mark ${label} as ${value ? 'verified' : 'pending verification'}?`, () => {
      const payload: any = {
        [field]: value,
      };
      this.http.patch(
        `${environment.apiBaseUrl}/admin/users/${userType}/${userId}/contact-verification`,
        payload,
        this.getAuthHeaders(),
      )
        .pipe(catchError(err => {
          alert('Error updating contact verification: ' + (err?.error?.message || err?.message || 'Unknown error'));
          return of(null);
        }))
        .subscribe((res: any) => {
          if (!res) return;
          user[field] = value;
          this.fetchUsers();
        });
    });
  }

  openVerificationDocsModal(user: any, userType: 'influencer' | 'brand' | 'photographer'): void {
    this.verificationDocsUser = user;
    this.verificationDocsUserType = userType;
    this.verificationDocsDraft = String(user?.verificationAdminNotes || '');
    this.showVerificationDocsModal = true;
  }

  closeVerificationDocsModal(): void {
    this.showVerificationDocsModal = false;
    this.verificationDocsUser = null;
    this.verificationDocsUserType = null;
    this.verificationDocsDraft = '';
  }

  updateInfluencerVerificationFromModal(action: 'pending' | 'approve' | 'reject' | 'remove'): void {
    if (!this.verificationDocsUser || !this.verificationDocsUserType) return;
    const user = this.verificationDocsUser;
    const userId = String(user?._id || '');
    if (!userId) return;
    const notes = this.verificationDocsDraft;
    const payload = { action, notes };
    this.http.patch(
      `${environment.apiBaseUrl}/admin/users/influencer/${userId}/verification`,
      payload,
      this.getAuthHeaders(),
    )
      .pipe(catchError(err => {
        alert('Error updating verification: ' + (err?.error?.message || err?.message || 'Unknown error'));
        return of(null);
      }))
      .subscribe((res: any) => {
        if (!res) return;
        this.closeVerificationDocsModal();
        this.fetchUsers();
      });
  }

  setVerificationNotes(user: any, value: string): void {
    const key = String(user?._id || '');
    if (!key) return;
    this.verificationNotesDraft[key] = value;
  }

  updateInfluencerVerification(user: any, action: 'pending' | 'approve' | 'reject' | 'remove') {
    const userId = String(user?._id || '');
    if (!userId) return;
    const notes = this.getVerificationNotes(user);
    const payload = { action, notes };
    this.http.patch(`${environment.apiBaseUrl}/admin/users/influencer/${userId}/verification`, payload, this.getAuthHeaders())
      .pipe(catchError(err => {
        alert('Error updating verification: ' + (err?.error?.message || err?.message || 'Unknown error'));
        return of(null);
      }))
      .subscribe((res: any) => {
        if (!res) return;
        this.fetchUsers();
      });
  }

  resetFilters(userType: 'influencer' | 'brand' | 'photographer') {
    if (userType === 'influencer') {
      this.influencerFilters = { status: '', premium: '', category: '', state: '', signupSource: '', badgeTag: '', emailVerified: '', mobileVerified: '' };
    } else if (userType === 'brand') {
      this.brandFilters = { status: '', premium: '', category: '', state: '', signupSource: '', badgeTag: '', emailVerified: '', mobileVerified: '' };
    } else {
      this.photographerFilters = { status: '', premium: '', category: '', state: '', signupSource: '', badgeTag: '', emailVerified: '', mobileVerified: '' };
    }
    this.applyFilters(userType);
    this.currentPage = 1;
  }

  getActiveUsers(): any[] {
    if (this.activeTab === 'influencer') return this.filteredInfluencers;
    if (this.activeTab === 'brand') return this.filteredBrands;
    return this.filteredPhotographers;
  }

  private matchesSearch(user: any): boolean {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return true;
    const text = [
      user?._id,
      user?.name,
      user?.brandName,
      user?.username,
      user?.brandUsername,
      user?.email,
      user?.phoneNumber,
      user?.location?.district,
      user?.location?.state,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(query);
  }

  getVisibleUsers(): any[] {
    return this.getActiveUsers().filter((user) => this.matchesSearch(user));
  }

  getPagedUsers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.getVisibleUsers().slice(start, start + this.pageSize);
  }

  getTotalVisibleUsers(): number {
    return this.getVisibleUsers().length;
  }

  getVisibleRangeStart(): number {
    return this.getTotalVisibleUsers() ? (this.currentPage - 1) * this.pageSize + 1 : 0;
  }

  getVisibleRangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.getTotalVisibleUsers());
  }

  onPageSizeChange(value: string | number): void {
    this.pageSize = Number(value) || 100;
    this.currentPage = 1;
  }

  hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  hasNextPage(): boolean {
    return this.currentPage * this.pageSize < this.getTotalVisibleUsers();
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage()) return;
    this.currentPage -= 1;
  }

  goToNextPage(): void {
    if (!this.hasNextPage()) return;
    this.currentPage += 1;
  }

  openUserDetails(user: any): void {
    this.selectedUser = user;
    this.selectedUserType = this.activeTab;
    this.selectedUserInternalNotes = String(user?.verificationAdminNotes || '');
    this.showUserDetailsModal = true;
  }

  closeUserDetailsModal(): void {
    this.showUserDetailsModal = false;
    this.selectedUser = null;
    this.selectedUserType = null;
    this.selectedUserInternalNotes = '';
  }

  onUserDetailsBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement)?.classList?.contains('modal')) {
      this.closeUserDetailsModal();
    }
  }

  getSelectedUserStatus(): string {
    if (!this.selectedUser?.status) return '-';
    return String(this.selectedUser.status);
  }

  toggleSelectedEmailVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    const nextValue = !this.isEmailVerified(this.selectedUser);
    this.updateContactVerification(this.selectedUser, this.selectedUserType, 'isEmailVerified', nextValue);
  }

  toggleSelectedMobileVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    const nextValue = !this.isMobileVerified(this.selectedUser);
    this.updateContactVerification(this.selectedUser, this.selectedUserType, 'isMobileVerified', nextValue);
  }

  saveSelectedUserNotes(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    const userId = String(this.selectedUser?._id || '');
    if (!userId) return;
    const payload = {
      action: this.selectedUser?.verificationStatus || 'pending',
      notes: this.selectedUserInternalNotes,
    };
    this.http
      .patch(`${environment.apiBaseUrl}/admin/users/${this.selectedUserType}/${userId}/verification`, payload, this.getAuthHeaders())
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        if (!res) return;
        this.selectedUser.verificationAdminNotes = this.selectedUserInternalNotes;
      });
  }

  getTagOptions(userType: 'influencer' | 'brand' | 'photographer'): string[] {
    if (userType === 'influencer') return this.influencerBadgeOptions;
    if (userType === 'brand') return this.brandBadgeOptions;
    return this.photographerBadgeOptions;
  }

  getRegularTagOptions(userType: 'influencer' | 'brand' | 'photographer'): string[] {
    const commissionTags = new Set(this.commissionBadgeOptions);
    return this.getTagOptions(userType).filter((tag) => !commissionTags.has(tag));
  }

  getCommissionTagOptions(userType: 'influencer' | 'brand' | 'photographer'): string[] {
    return this.commissionBadgeOptions;
  }

  private isCommissionTag(tag: string): boolean {
    return this.commissionBadgeOptions.includes(tag);
  }

  getUserTags(user: any): string[] {
    const tags = Array.isArray(user?.adminTags)
      ? user.adminTags.filter((tag: any) => !!String(tag || '').trim())
      : [];
    const commissionTags = this.commissionBadgeOptions;

    const commissionBadgeMap: Record<string, string> = {
      early_access_creator: 'Early Access',
      partner_creator: 'Partner',
      internal_test_creator: 'Internal/Test',
      early_access_brand: 'Early Access',
      partner_brand: 'Partner',
      internal_test_brand: 'Internal/Test',
      launch_partner: 'Partner',
      zero_commission_creator: 'Early Access',
      zero_commission_brand: 'Early Access',
    };

    const commissionTag = user?.commissionBadge
      ? (commissionBadgeMap[String(user.commissionBadge)] || '')
      : '';
    const regularTags = tags.filter((tag: string) => !commissionTags.includes(tag));
    const fallbackCommissionTag = commissionTags.find((tag) => tags.includes(tag)) || '';
    const effectiveCommissionTag = commissionTag || fallbackCommissionTag;

    return [
      ...new Set([
        ...regularTags,
        ...(effectiveCommissionTag ? [effectiveCommissionTag] : []),
      ]),
    ];
  }

  getTagBadgeClass(tag: string): string {
    const normalized = String(tag || '').toLowerCase();
    if (normalized.includes('featured')) return 'bg-primary';
    if (normalized.includes('founder')) return 'bg-warning text-dark';
    if (normalized.includes('verified')) return 'bg-success';
    if (normalized.includes('internal')) return 'bg-info text-dark';
    if (normalized.includes('partner')) return 'bg-primary';
    if (normalized.includes('early access')) return 'bg-dark';
    return 'bg-secondary';
  }

  getCommissionBenefitText(user: any): string {
    const badge = String(user?.commissionBadge || '');
    const override = user?.commissionOverride;
    if (!badge || !override?.enabled) return '';

    const untilDate = override.validUntil ? new Date(override.validUntil) : null;
    const untilText = untilDate
      ? ` till ${untilDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : '';

    if (badge.includes('early_access')) {
      return `0% commission${untilText}`;
    }
    if (badge.includes('internal_test')) {
      return `0% commission${untilText}`;
    }
    if (badge.includes('partner')) {
      const value = typeof override.value === 'number' ? override.value : 0;
      const displayPercent = override.overrideType === 'fixed' ? `${value}%` : 'custom';
      return `${displayPercent} commission${untilText}`;
    }
    return '';
  }

  openTagModal(user: any, userType: 'influencer' | 'brand' | 'photographer') {
    this.tagUserId = user?._id || null;
    this.tagType = userType;
    this.selectedTagOptions = [...this.getUserTags(user)];
    this.showTagModal = true;
  }

  toggleTagSelection(tag: string) {
    if (!tag) return;
    const isCommissionTag = this.isCommissionTag(tag);
    const siblingTags = isCommissionTag
      ? this.getCommissionTagOptions(this.tagType || this.activeTab)
      : this.getRegularTagOptions(this.tagType || this.activeTab);

    if (this.selectedTagOptions.includes(tag)) {
      this.selectedTagOptions = this.selectedTagOptions.filter((value) => value !== tag);
      return;
    }

    this.selectedTagOptions = [
      ...this.selectedTagOptions.filter((value) => !siblingTags.includes(value)),
      tag,
    ];
  }

  saveTags() {
    if (!this.tagUserId || !this.tagType) {
      return;
    }
    const payload = { adminTags: this.selectedTagOptions };
    this.http.patch(`${environment.apiBaseUrl}/admin/users/${this.tagType}/${this.tagUserId}/tags`, payload, this.getAuthHeaders())
      .pipe(catchError(err => {
        alert('Error updating tags: ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)));
        return of(null);
      }))
      .subscribe((res: any) => {
        if (res?.blocked) {
          const warningText = Array.isArray(res?.warnings) && res.warnings.length
            ? `\n\nReason:\n- ${res.warnings.join('\n- ')}`
            : '';
          alert(`Tags were not updated.${warningText}`);
          return;
        }
        if (res?.user) {
          const warningText = Array.isArray(res?.warnings) && res.warnings.length
            ? `\n\nNote:\n- ${res.warnings.join('\n- ')}`
            : '';
          alert(`Tags updated successfully!${warningText}`);
          this.showTagModal = false;
          this.tagUserId = null;
          this.tagType = null;
          this.selectedTagOptions = [];
          this.fetchUsers();
          return;
        }
        if (res) {
          this.showTagModal = false;
          this.tagUserId = null;
          this.tagType = null;
          this.selectedTagOptions = [];
          this.fetchUsers();
        }
      });
  }

  closeTagModal() {
    this.showTagModal = false;
    this.tagUserId = null;
    this.tagType = null;
    this.selectedTagOptions = [];
  }

  setTab(tab: 'influencer' | 'brand' | 'photographer') {
    this.activeTab = tab;
    this.currentPage = 1;
    // Reset modal state when switching tabs to avoid blank screen
    this.showPremiumModal = false;
    this.premiumUserId = null;
    this.premiumDuration = '';
    this.premiumType = null;
    // Always refetch users when switching tabs (especially for Deleted Users view)
    this.fetchUsers();
  }

  getAuthHeaders() {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  acceptUser(userId: string) {
    this.showConfirm('Accept this user?', () => {
      this.http.patch(`${environment.apiBaseUrl}/users/${userId}/accept`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
    });
  }
  declineUser(userId: string) {
    this.showConfirm('Decline this user?', () => {
      this.http.patch(`${environment.apiBaseUrl}/users/${userId}/decline`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
    });
  }
  deleteUser(userId: string) {
    this.showConfirm('Delete this user? This cannot be undone.', () => {
      this.isLoading = true;
      this.http.patch(`${environment.apiBaseUrl}/users/${userId}/delete`, {}, this.getAuthHeaders()).subscribe(() => {
        this.fetchUsers();
        window.dispatchEvent(new CustomEvent('user-deleted-refresh'));
        setTimeout(() => { this.isLoading = false; }, 500);
      });
    });
  }
  restoreUser(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/restore`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
  }
  deletePermanently(userId: string) {
    this.isLoading = true;
    this.http.delete(`${environment.apiBaseUrl}/users/${userId}/permanent`, this.getAuthHeaders()).subscribe(() => {
      this.fetchUsers();
      setTimeout(() => { this.isLoading = false; }, 500);
    });
  }
  setPremium(userId: string, isPremium: boolean, userType: 'influencer' | 'brand' | 'photographer') {
      try {
        this.premiumType = userType;
        if (isPremium) {
          this.premiumUserId = userId;
          this.premiumDuration = '';
          this.premiumIsPremium = true;
          this.showPremiumModal = true;
        } else {
          // Show confirmation before setting free
          if (confirm('Are you sure you want to set this user as Free? This will remove their premium status.')) {
            this.http.patch(`${environment.apiBaseUrl}/users/${userId}/premium`, { isPremium: false, type: userType }, this.getAuthHeaders())
              .pipe(catchError(err => {
                alert('Error setting user as Free: ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)));
                return of(null);
              }))
              .subscribe(() => this.fetchUsers());
          }
        }
      } catch (err) {
        let msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
        alert('Error in setPremium: ' + msg);
      }
  }

  confirmPremium() {
    if (!this.premiumUserId || !this.premiumDuration) {
      alert('Please select a premium duration.');
      return;
    }
    const payload = { isPremium: true, premiumDuration: this.premiumDuration, type: this.premiumType };
    this.http.patch(`${environment.apiBaseUrl}/users/${this.premiumUserId}/premium`, payload, this.getAuthHeaders())
      .pipe(catchError(err => {
        alert('Error setting user as Premium: ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)));
        return of(null);
      }))
      .subscribe((res) => {
        // Close modal after success
        this.showPremiumModal = false;
        this.premiumUserId = null;
        this.premiumDuration = '';
        this.premiumType = null;
        this.fetchUsers();
        if (res) {
          alert('User has been set as Premium successfully!');
        }
      });
  }

  closePremiumModal() {
    this.showPremiumModal = false;
    this.premiumUserId = null;
    this.premiumDuration = '';
    this.premiumType = null;
  }

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  // Handle product link click
  onProductClick(user: any, product: any, index: number) {
    // Open product image in new tab if available
    if (typeof product === 'string' && product.startsWith('http')) {
      window.open(product, '_blank');
    } else if (product && product.imageUrl) {
      window.open(product.imageUrl, '_blank');
    } else {
      alert('No image available for this product.');
    }
  }

  updateUserPrice(user: any, userType: 'influencer' | 'brand') {
    const currentPrice = user.promotionalPrice ?? user.price;
    if (user.editPrice === undefined || user.editPrice === currentPrice) return;
    const url = userType === 'influencer'
      ? `${environment.apiBaseUrl}/users/influencer-profile`
      : `${environment.apiBaseUrl}/users/brand-profile`;
    const payload = { promotionalPrice: user.editPrice, _id: user._id };
    this.http.patch(url, payload, this.getAuthHeaders())
      .pipe(catchError(err => {
        alert('Error updating price: ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)));
        return of(null);
      }))
      .subscribe((res: any) => {
        if (res && res.user) {
          user.promotionalPrice = res.user.promotionalPrice ?? res.user.price;
          user.editPrice = user.promotionalPrice;
          alert('Price updated successfully!');
        } else {
          alert('Price update failed.');
        }
      });
  }

}
