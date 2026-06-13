import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { ConfigService } from '../../../shared/config.service';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AdminConfirmDialogComponent } from '../../../shared/admin-confirm-dialog/admin-confirm-dialog.component';
import { buildDefaultUserTagOptions } from '../../../shared/constants/user-tag-options.constants';
import { buildSocialProfileUrl, normalizeSocialHandle } from '../../../shared/social-handle.util';
import { TIER_DESC_MAP } from '../../../shared/tiers.constants';
import {
  ProfileFlag,
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../../services/profile-verification.service';
import { ProfileReviewPanelComponent } from '../../../shared/profile-verification/profile-review-panel.component';
import { ImageGalleryModalComponent } from '../../../shared/components/image-gallery-modal/image-gallery-modal.component';
import { VerificationFieldComponent } from '../../../shared/components/verification-field/verification-field.component';

@Component({
  selector: 'app-admin-user-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminConfirmDialogComponent,
    ProfileReviewPanelComponent,
    ImageGalleryModalComponent,
    VerificationFieldComponent,
  ],
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
  selectedProfileVerification: ProfileVerificationDashboard | null = null;
  selectedProfileVerificationLoading = false;
  galleryModalOpen = false;
  galleryModalImages: string[] = [];
  galleryModalIndex = 0;

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
    this.fetchUsers(this.activeTab);
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

  getUserProfilePhotoStatus(user: any): string {
    const reviewItem = this.selectedProfileVerification?.checklist?.find(
      (item) => String(item?.label || '').toLowerCase() === 'profile photo',
    );
    if (reviewItem?.status) return reviewItem.status;
    const avatar = this.getUserAvatar(user, this.selectedUserType || this.activeTab);
    return avatar.includes('default-profile') ? 'Missing' : 'Attached';
  }

  isProfilePhotoVerified(user: any): boolean {
    return this.getUserProfilePhotoStatus(user) === 'Verified';
  }

  private getChecklistStatus(label: string): string {
    const reviewItem = this.selectedProfileVerification?.checklist?.find(
      (item) => String(item?.label || '').toLowerCase() === label.toLowerCase(),
    );
    return String(reviewItem?.status || '');
  }

  getUserGalleryImageCount(user: any): number {
    const explicitGallery = Array.isArray(user?.galleryImages)
      ? user.galleryImages
      : Array.isArray(user?.products)
        ? user.products
        : [];
    const profileImages = Array.isArray(user?.profileImages) ? user.profileImages : [];
    return explicitGallery.filter((img: any) => !!(img?.url || img)).length + Math.max(0, profileImages.length - 1);
  }

  getUserGalleryImages(user: any): string[] {
    const explicitGallery = Array.isArray(user?.galleryImages)
      ? user.galleryImages
      : Array.isArray(user?.products)
        ? user.products
        : [];
    const profileImages = Array.isArray(user?.profileImages) ? user.profileImages.slice(1) : [];
    return [...explicitGallery, ...profileImages]
      .map((img: any) => String(img?.url || img || '').trim())
      .filter((url: string) => !!url);
  }

  openUserGalleryModal(user: any, index = 0): void {
    const images = this.getUserGalleryImages(user);
    if (!images.length) return;
    this.galleryModalImages = images;
    this.galleryModalIndex = Math.max(0, Math.min(index, images.length - 1));
    this.galleryModalOpen = true;
  }

  closeGalleryModal(): void {
    this.galleryModalOpen = false;
    this.galleryModalImages = [];
    this.galleryModalIndex = 0;
  }

  getUserGalleryStatus(user: any): string {
    const status = this.getChecklistStatus('Gallery Images Attached');
    if (status) return status;
    return this.getUserGalleryImageCount(user) > 0 ? 'Attached' : 'Missing';
  }

  isGalleryImagesVerified(user: any): boolean {
    return this.getUserGalleryStatus(user) === 'Verified' || this.getUserGalleryStatus(user) === 'Attached';
  }

  getUserCreatorTierSummary(user: any): string {
    const tiers = (Array.isArray(user?.socialMedia) ? user.socialMedia : [])
      .map((sm: any) => this.getSocialTierLabel(sm))
      .filter((tier: string) => !!tier);
    const uniqueTiers = Array.from(new Set(tiers));
    return uniqueTiers.length ? uniqueTiers.join(', ') : '-';
  }

  getUserCreatorTierStatus(): string {
    return this.getChecklistStatus('Social Profile & Creator Tier') || 'Verified';
  }

  isCreatorTierVerified(): boolean {
    return this.getUserCreatorTierStatus() === 'Verified';
  }

  getUserLocationVerificationStatus(user: any): string {
    const checks = this.selectedProfileVerification?.verificationChecks || {};
    const hasLocationIssue = (this.selectedProfileVerification?.actionRequired || []).some((flag: any) =>
      ['LOCATION_MISSING', 'LOCATION_MISMATCH', 'INTERNATIONAL_LOCATION'].includes(String(flag?.flagCode || '')),
    );
    const hasLocation = !!(user?.location?.state || user?.location?.district);
    return checks['locationVerified'] || user?.locationVerified || (hasLocation && !hasLocationIssue) ? 'Verified' : 'Pending';
  }

  isLocationVerified(user: any): boolean {
    return this.getUserLocationVerificationStatus(user) === 'Verified';
  }

  getUserPaymentVerificationStatus(user: any): string {
    const status = this.getChecklistStatus('Payment Method Verified');
    if (status && status !== 'Verified') return status;
    const checks = this.selectedProfileVerification?.verificationChecks || {};
    return checks['paymentVerified'] || user?.paymentVerified || status === 'Verified' || this.hasUserPaymentMethod(user) ? 'Verified' : 'Pending';
  }

  isPaymentMethodVerified(user: any): boolean {
    return this.getUserPaymentVerificationStatus(user) === 'Verified';
  }

  getUserDisplayName(user: any): string {
    return user?.brandName || user?.name || '-';
  }

  getUserHandle(user: any): string {
    const handle = user?.username || user?.brandUsername || user?.userName || user?.brand_username;
    return handle ? `@${handle}` : '-';
  }

  getUserStatusKey(user: any): 'accepted' | 'pending' | 'rejected' | 'deleted' | 'other' {
    if (this.isDeletedUser(user)) return 'deleted';
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
    return `ts-status-${this.getUserStatusKey(user)}`;
  }

  getUserStatusRowClass(user: any): string {
    return `ts-status-row ts-status-row--${this.getUserStatusKey(user)}`;
  }

  private isDeletedUser(user: any): boolean {
    const isDeleted = String(user?.isDeleted || '').toLowerCase() === 'true';
    const status = String(user?.status || '').trim().toLowerCase();
    return user?.isDeleted === true || isDeleted || status === 'deleted';
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

  getUserSocialRateGroups(user: any): Array<{ platform: string; icon: string; href: string; handle: string; tierLabel: string; items: Array<{ name: string; price: number }> }> {
    const rows = Array.isArray(user?.socialMedia) ? user.socialMedia : [];
    return rows
      .map((sm: any) => {
        const platformKey = this.resolveSocialPlatform(sm);
        const platform = this.getSocialLabel(platformKey);
        const href = this.resolveSocialHref(sm, platformKey);
        const handle =
          normalizeSocialHandle(sm?.handle, platformKey) ||
          normalizeSocialHandle(sm?.url, platformKey);
        const items = (Array.isArray(sm?.contentTypes) ? sm.contentTypes : [])
          .filter((ct: any) => this.isEnabledPricedItem(ct))
          .map((ct: any) => ({
            name: String(ct?.name || ct?.label || '').trim(),
            price: Number(ct?.price) || 0,
          }))
          .filter((item: any) => item.name && item.price > 0);
        return {
          platform,
          icon: this.getSocialIcon(platformKey),
          href: href || '',
          handle: handle ? `@${handle}` : '',
          tierLabel: this.getSocialTierLabel(sm),
          items,
        };
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
    const payout = user?.payout || {};
    const upiId = String(payout?.upiId || '').trim();
    const mobile = String(payout?.mobile || '').trim();
    const accountHolderName = String(payout?.accountHolderName || '').trim();
    if (upiId || mobile || accountHolderName) {
      const parts: string[] = [];
      if (upiId) parts.push(`UPI: ${upiId}`);
      if (mobile) parts.push(`Mobile: ${mobile}`);
      if (accountHolderName) parts.push(`Name: ${accountHolderName}`);
      return parts.join(' | ');
    }
    const method = String(user?.latestPayment?.paymentMethod || '').toLowerCase();
    if (method === 'upi') return 'UPI';
    if (method === 'qr') return 'QR Code';
    if (user?.isPremium && (!method || method === 'admin')) {
      const duration = this.getPremiumDurationLabel(user?.premiumDuration);
      return duration ? `Admin Granted (${duration})` : 'Admin Granted';
    }
    return '-';
  }

  hasUserPaymentMethod(user: any): boolean {
    const payout = user?.payout || {};
    return !!(
      String(payout?.upiId || '').trim() ||
      String(payout?.mobile || '').trim() ||
      String(payout?.accountHolderName || '').trim() ||
      String(user?.latestPayment?.paymentMethod || '').trim()
    );
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
        const rawHandle =
          normalizeSocialHandle(sm?.handle, platform) ||
          normalizeSocialHandle(sm?.url, platform);
        const label = this.getSocialLabel(platform);
        const tierLabel = this.getSocialTierLabel(sm);
        if (!href && !rawHandle && !tierLabel && platform === 'social') return null;
        return {
          href: href || '#',
          icon: this.getSocialIcon(platform),
          label,
          shortLabel: this.getSocialShortLabel(platform),
          handle: rawHandle ? `@${rawHandle}` : '-',
          followers,
          tierLabel,
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
    return 'Photo/Video';
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
    mobileVerified: '',
    contactVerification: ''
  };
  brandFilters = {
    status: '',
    premium: '',
    category: '',
    state: '',
    signupSource: '',
    badgeTag: '',
    emailVerified: '',
    mobileVerified: '',
    contactVerification: ''
  };
  photographerFilters = {
    status: '',
    premium: '',
    category: '',
    state: '',
    signupSource: '',
    badgeTag: '',
    emailVerified: '',
    mobileVerified: '',
    contactVerification: ''
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

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private cd: ChangeDetectorRef,
    private profileVerification: ProfileVerificationService,
  ) {}

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


  private getAdminListUrl(userType: 'influencer' | 'brand' | 'photographer'): string {
    const endpoint =
      userType === 'influencer'
        ? 'influencers'
        : userType === 'brand'
          ? 'brands'
          : 'photographers';
    const params = new URLSearchParams();
    if (this.isDeletedTab()) params.set('status', 'deleted');
    const verification = this.getActiveFilterValue('contactVerification');
    if (verification) params.set('verification', verification);
    params.set('limit', '1000');
    return `${environment.apiBaseUrl}/admin/${endpoint}?${params.toString()}`;
  }

  private setUsersByType(userType: 'influencer' | 'brand' | 'photographer', users: any[]): void {
    if (userType === 'influencer') {
      this.influencers = users;
    } else if (userType === 'brand') {
      this.brands = users;
    } else {
      this.photographers = users;
    }
  }

  fetchUsers(userType: 'influencer' | 'brand' | 'photographer' = this.activeTab) {
    this.isLoading = true;
    const headers = this.getAuthHeaders();
    this.http.get<any>(this.getAdminListUrl(userType), headers)
      .pipe(timeout(5000), catchError(() => of([])))
      .subscribe((res: any) => {
        const users = Array.isArray(res) ? res : (res?.data || []);
        this.setUsersByType(userType, users);
        this.applyFilters(userType);
        this.updateAllFilterOptions(userType);
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

  updateAllFilterOptions(userType: 'influencer' | 'brand' | 'photographer' = this.activeTab) {
    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();
    const statusSet = new Set<string>();
    const signupSourceSet = new Set<string>();

    this.getUsersByType(userType).forEach(user => {
      const categories = Array.isArray(user.categories)
        ? user.categories
        : Array.isArray(user.skills)
          ? user.skills
          : [];
      categories.forEach((cat: string) => categoriesSet.add(cat));
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
      filtered = filtered.filter(user => this.isDeletedUser(user));
    } else {
      filtered = filtered.filter(user => !this.isDeletedUser(user));
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

    if (filters.contactVerification === 'email_pending' && user.isEmailVerified) {
      return false;
    }
    if (filters.contactVerification === 'mobile_pending' && user.isMobileVerified) {
      return false;
    }
    if (
      filters.contactVerification === 'email_or_mobile_pending' &&
      user.isEmailVerified &&
      user.isMobileVerified
    ) {
      return false;
    }
    if (
      filters.contactVerification === 'both_pending' &&
      (user.isEmailVerified || user.isMobileVerified)
    ) {
      return false;
    }
    if (
      filters.contactVerification === 'both_verified' &&
      (!user.isEmailVerified || !user.isMobileVerified)
    ) {
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
    if (field === 'contactVerification') {
      this.fetchUsers(this.activeTab);
      return;
    }
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

  getDisplayPhoneNumber(user: any): string {
    const raw = String(user?.phoneNumber || '').trim();
    if (!raw) return '-';
    const lower = raw.toLowerCase();
    if (lower.startsWith('firebase:') || lower.startsWith('pending-mobile:')) {
      return '-';
    }
    return raw;
  }

  getMobileVerificationSource(user: any): string {
    if (!this.isMobileVerified(user)) return 'Pending';
    const method = String(user?.mobileVerificationMethod || '').trim();
    const verifiedBy = String(user?.mobileVerifiedBy || '').trim();
    if (verifiedBy && method) return `${method} by ${verifiedBy}`;
    if (verifiedBy) return `Verified by ${verifiedBy}`;
    if (method) return `Verified via ${method}`;
    return 'Verified';
  }

  updateContactVerification(
    user: any,
    userType: 'influencer' | 'brand' | 'photographer',
    field:
      | 'isEmailVerified'
      | 'isMobileVerified'
      | 'profilePhotoVerified'
      | 'creatorTierVerified'
      | 'locationVerified'
      | 'galleryImagesVerified'
      | 'paymentVerified',
    value: boolean,
  ): void {
    const userId = String(user?._id || '');
    if (!userId) return;
    const label =
      field === 'isEmailVerified'
        ? 'email'
        : field === 'isMobileVerified'
          ? 'mobile'
          : field === 'profilePhotoVerified'
            ? 'profile photo'
            : field === 'creatorTierVerified'
              ? 'creator tier/social links'
              : field === 'locationVerified'
                ? 'location'
                : field === 'galleryImagesVerified'
                  ? 'gallery images'
                  : 'payment method';
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
          if (field === 'isEmailVerified') {
            user.emailVerifiedAt = value ? (user.emailVerifiedAt || new Date().toISOString()) : null;
          }
          if (field === 'isMobileVerified') {
            user.mobileVerified = value;
            user.mobileVerifiedAt = value ? (user.mobileVerifiedAt || new Date().toISOString()) : null;
            user.mobileVerificationMethod = value ? (user.mobileVerificationMethod || 'Manual') : '';
            user.mobileVerifiedBy = value ? (user.mobileVerifiedBy || 'Admin') : '';
          }
          if (field === 'locationVerified') {
            user.locationVerified = value;
            user.locationVerifiedAt = value ? (user.locationVerifiedAt || new Date().toISOString()) : null;
          }
          if (field === 'paymentVerified') {
            user.paymentVerified = value;
            user.paymentVerifiedAt = value ? (user.paymentVerifiedAt || new Date().toISOString()) : null;
          }
          this.loadSelectedProfileVerification();
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
      this.influencerFilters = { status: '', premium: '', category: '', state: '', signupSource: '', badgeTag: '', emailVerified: '', mobileVerified: '', contactVerification: '' };
    } else if (userType === 'brand') {
      this.brandFilters = { status: '', premium: '', category: '', state: '', signupSource: '', badgeTag: '', emailVerified: '', mobileVerified: '', contactVerification: '' };
    } else {
      this.photographerFilters = { status: '', premium: '', category: '', state: '', signupSource: '', badgeTag: '', emailVerified: '', mobileVerified: '', contactVerification: '' };
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
      this.getDisplayPhoneNumber(user) !== '-' ? this.getDisplayPhoneNumber(user) : '',
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
    this.loadSelectedProfileVerification();
  }

  closeUserDetailsModal(): void {
    this.showUserDetailsModal = false;
    this.selectedUser = null;
    this.selectedUserType = null;
    this.selectedUserInternalNotes = '';
    this.selectedProfileVerification = null;
    this.selectedProfileVerificationLoading = false;
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

  getAdminUserType(userType: 'influencer' | 'brand' | 'photographer' | null): 'Influencer' | 'Brand' | 'Photographer' {
    if (userType === 'brand') return 'Brand';
    if (userType === 'photographer') return 'Photographer';
    return 'Influencer';
  }

  loadSelectedProfileVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    const userId = String(this.selectedUser?._id || '');
    if (!userId) return;
    this.selectedProfileVerificationLoading = true;
    this.selectedProfileVerification = null;
    this.profileVerification
      .getModerationDetail(this.getAdminUserType(this.selectedUserType), userId)
      .pipe(catchError(() => of(null)))
      .subscribe((detail: ProfileVerificationDashboard | null) => {
        this.selectedProfileVerification = detail;
        this.selectedProfileVerificationLoading = false;
        this.cd.detectChanges();
      });
  }

  getProfileVerificationScore(): number {
    return Number(this.selectedProfileVerification?.profileQualityScore ?? this.selectedUser?.profileQualityScore ?? 100);
  }

  getProfileCompletionScore(): number {
    return Number(this.selectedProfileVerification?.profileCompletion ?? this.selectedUser?.profileCompletion ?? 0);
  }

  getVerificationDashboardStatus(): string {
    return String(this.selectedProfileVerification?.verificationStatus || this.selectedUser?.verificationDashboardStatus || 'Draft');
  }

  getVerificationChecks(): Record<string, any> {
    return this.selectedProfileVerification?.verificationChecks || {};
  }

  getVerificationBadges(): Array<{ label: string; verified: boolean }> {
    const badges = this.selectedProfileVerification?.verificationBadges;
    if (Array.isArray(badges) && badges.length) return badges;
    return [
      { label: 'Email Verified', verified: this.isEmailVerified(this.selectedUser) },
      { label: 'Mobile Verified', verified: this.isMobileVerified(this.selectedUser) },
      { label: 'Identity Verified', verified: !!(this.selectedUser?.identityVerified || this.selectedUser?.identityConfirmed) },
      { label: 'Location Verified', verified: !!this.selectedUser?.locationVerified },
      { label: 'Social Verified', verified: !!(this.selectedUser?.socialVerified || this.selectedUser?.socialProfilesReviewed) },
      { label: 'Payment Verified', verified: !!this.selectedUser?.paymentVerified },
    ];
  }

  getOpenVerificationFlags(): any[] {
    return this.selectedProfileVerification?.actionRequired || [];
  }

  getVerificationIssueText(flag: any): string {
    return String(flag?.message || flag?.flagCode || 'Profile issue');
  }

  getProfileEditRoute(): string {
    if ((this.selectedUserType || this.activeTab) === 'brand') return '/brand-profile';
    if ((this.selectedUserType || this.activeTab) === 'photographer') return '/photographer-profile';
    return '/influencer-profile';
  }

  setVerificationCheck(field: string, value: boolean): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    const userId = String(this.selectedUser?._id || '');
    if (!userId) return;
    this.profileVerification
      .updateChecks(this.getAdminUserType(this.selectedUserType), userId, { [field]: value })
      .pipe(catchError((err) => {
        alert('Error updating verification check: ' + (err?.error?.message || err?.message || 'Unknown error'));
        return of(null);
      }))
      .subscribe((detail: ProfileVerificationDashboard | null) => {
        if (!detail) return;
        this.selectedProfileVerification = detail;
        const checks = detail.verificationChecks || {};
        this.selectedUser = {
          ...this.selectedUser,
          verificationCallCompleted: !!checks['verificationCallCompleted'],
          identityVerified: !!checks['identityVerified'],
          identityConfirmed: !!checks['identityVerified'],
          locationVerified: !!checks['locationVerified'],
          socialVerified: !!checks['socialVerified'],
          socialProfilesReviewed: !!checks['socialVerified'],
          paymentVerified: !!checks['paymentVerified'],
          panVerified: !!checks['panVerified'],
          profileCompletion: detail.profileCompletion,
          profileQualityScore: detail.profileQualityScore,
          verificationDashboardStatus: detail.verificationStatus,
        };
        this.fetchUsers();
        this.cd.detectChanges();
      });
  }

  private syncSelectedUserFromProfileReview(detail: ProfileVerificationDashboard): void {
    const checks = detail.verificationChecks || {};
    this.selectedUser = {
      ...this.selectedUser,
      verificationCallCompleted: !!checks['verificationCallCompleted'],
      identityVerified: !!checks['identityVerified'],
      identityConfirmed: !!checks['identityVerified'],
      locationVerified: !!checks['locationVerified'],
      socialVerified: !!checks['socialVerified'],
      socialProfilesReviewed: !!checks['socialVerified'],
      paymentVerified: !!checks['paymentVerified'],
      panVerified: !!checks['panVerified'],
      profileCompletion: detail.profileCompletion,
      profileQualityScore: detail.profileQualityScore,
      verificationDashboardStatus: detail.verificationStatus,
      verificationAdminNotes: this.selectedUserInternalNotes,
    };
  }

  takeSelectedProfileAction(action: string): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    const userId = String(this.selectedUser?._id || '');
    if (!userId) return;
    this.profileVerification
      .action(this.getAdminUserType(this.selectedUserType), userId, action, this.selectedUserInternalNotes)
      .pipe(catchError((err) => {
        alert('Profile review action failed: ' + (err?.error?.message || err?.message || 'Unknown error'));
        return of(null);
      }))
      .subscribe((detail: ProfileVerificationDashboard | null) => {
        if (!detail) return;
        this.selectedProfileVerification = detail;
        this.syncSelectedUserFromProfileReview(detail);
        this.fetchUsers(this.selectedUserType || this.activeTab);
        this.cd.detectChanges();
      });
  }

  updateSelectedProfileFlag(flag: ProfileFlag, status: 'Resolved' | 'Ignored'): void {
    const flagId = flag?._id || flag?.id;
    if (!flagId) return;
    this.profileVerification
      .updateFlag(flagId, { status, reviewNotes: this.selectedUserInternalNotes })
      .pipe(catchError((err) => {
        alert('Profile flag update failed: ' + (err?.error?.message || err?.message || 'Unknown error'));
        return of(null);
      }))
      .subscribe((res) => {
        if (!res) return;
        this.loadSelectedProfileVerification();
      });
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

  toggleSelectedProfilePhotoVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    const nextValue = !this.isProfilePhotoVerified(this.selectedUser);
    this.updateContactVerification(this.selectedUser, this.selectedUserType, 'profilePhotoVerified', nextValue);
  }

  toggleSelectedCreatorTierVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    this.updateContactVerification(this.selectedUser, this.selectedUserType, 'creatorTierVerified', !this.isCreatorTierVerified());
  }

  toggleSelectedLocationVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    this.updateContactVerification(this.selectedUser, this.selectedUserType, 'locationVerified', !this.isLocationVerified(this.selectedUser));
  }

  toggleSelectedGalleryImagesVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    this.updateContactVerification(this.selectedUser, this.selectedUserType, 'galleryImagesVerified', !this.isGalleryImagesVerified(this.selectedUser));
  }

  toggleSelectedPaymentVerification(): void {
    if (!this.selectedUser || !this.selectedUserType) return;
    this.updateContactVerification(this.selectedUser, this.selectedUserType, 'paymentVerified', !this.isPaymentMethodVerified(this.selectedUser));
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
    this.fetchUsers(tab);
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
