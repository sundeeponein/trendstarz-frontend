import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ConfigService } from '../../config.service';
import { SessionService } from '../../../core/session.service';
import { VisibilityService } from '../../../core/visibility.service';
import { SocialClickTrackerService } from '../../../services/social-click-tracker.service';
import { ProfileSocialPlatformsComponent } from '../profile-social-platforms/profile-social-platforms.component';
import { environment } from '../../../../environments/environment';
import { CollaborationAvailabilityViewComponent } from '../../collaboration-availability/collaboration-availability-view.component';
import { buildSocialProfileUrl } from '../../social-handle.util';
import { ImageGalleryModalComponent } from '../../components/image-gallery-modal/image-gallery-modal.component';

@Component({
  selector: 'app-photographer-profile-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ProfileSocialPlatformsComponent,
    CollaborationAvailabilityViewComponent,
    ImageGalleryModalComponent,
  ],
  templateUrl: './photographer-profile-view.component.html',
  styleUrls: ['./photographer-profile-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotographerProfileViewComponent implements OnInit {
  photographer: any = null;
  loading = true;
  error = '';
  showContact = false;
  pricingLabelMap: Record<string, string> = {};
  galleryModalOpen = false;
  galleryModalIndex = 0;

  private readonly fallbackPricingLabelMap: Record<string, string> = {
    'Starting Price': 'Starting Price',
    'Per Reel': 'Per Reel',
    'Per Shoot': 'Per Shoot',
    'Hourly': 'Hourly',
    'Equipment': 'Equipment Rental',
  };

  get isLoggedIn(): boolean {
    return this.visibility.isLoggedIn();
  }

  get isProViewer(): boolean {
    return this.visibility.isPro();
  }

  get isFreeViewer(): boolean {
    return this.visibility.isFree();
  }

  get isGuestViewer(): boolean {
    return this.visibility.isGuest();
  }

  get isBrandViewer(): boolean {
    const role = String(this.session.getUser()?.role || '').toLowerCase();
    return role === 'brand';
  }

  get isInfluencerViewer(): boolean {
    const role = String(this.session.getUser()?.role || '').toLowerCase();
    return role === 'influencer';
  }

  get isPhotographerViewer(): boolean {
    const role = String(this.session.getUser()?.role || '').toLowerCase();
    return role === 'photographer';
  }

  get canViewContactDetails(): boolean {
    return !!this.photographer && this.photographer.contactRestricted !== true;
  }

  get isPhoneVerified(): boolean {
    return !!(this.photographer?.phoneVerified ?? this.photographer?.isMobileVerified);
  }

  get isEmailVerified(): boolean {
    return !!this.photographer?.isEmailVerified;
  }

  get displayImage(): string {
    const firstImage = this.photographer?.profileImages?.[0];
    const firstImageUrl =
      typeof firstImage === 'string'
        ? firstImage
        : (firstImage?.url || firstImage?.secure_url || '');
    const imageUrl = firstImageUrl || this.photographer?.profileImage;
    return this.normalizeImageUrl(imageUrl, 220, 220) || 'assets/default-profile.png';
  }
  
  get isTrendstarzVerified(): boolean {
    return !!this.photographer?.verifiedByTrendStarz || String(this.photographer?.verificationStatus || '').toLowerCase() === 'approved';
  }
  
  get displayTags(): string[] {
    const hiddenCommissionTags = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return Array.isArray(this.photographer?.adminTags)
      ? this.photographer.adminTags
          .filter((tag: any) => !!String(tag || '').trim())
          .filter((tag: any) => !hiddenCommissionTags.has(String(tag || '').trim().toLowerCase()))
      : [];
  }

  tagBadgeClass(tag: string): string {
    const normalized = String(tag || '').toLowerCase();
    if (normalized.includes('founder')) return 'badge--founder';
    if (normalized.includes('verified')) return 'badge--verified';
    if (normalized.includes('internal')) return 'badge--internal';
    return 'badge--neutral';
  }

  get galleryImages(): string[] {
    const raw = Array.isArray(this.photographer?.profileImages) ? this.photographer.profileImages : [];
    const normalized = raw
      .map((entry: any) => this.normalizeImageUrl(typeof entry === 'string' ? entry : entry?.url))
      .filter((url: string) => !!url);
    return Array.from(new Set<string>(normalized));
  }

  openGalleryModal(index: number): void {
    if (!this.galleryImages.length) return;
    this.galleryModalIndex = Math.max(0, Math.min(index, this.galleryImages.length - 1));
    this.galleryModalOpen = true;
  }

  closeGalleryModal(): void {
    this.galleryModalOpen = false;
  }

  getGalleryImageSrc(imageUrl: string): string {
    if (!imageUrl) return '';
    return this.normalizeImageUrl(imageUrl, 240, 240);
  }

  getProfileSrcSet(): string {
    const firstImage = this.photographer?.profileImages?.[0];
    const firstImageUrl =
      typeof firstImage === 'string'
        ? firstImage
        : (firstImage?.url || firstImage?.secure_url || '');
    const imageUrl = firstImageUrl || this.photographer?.profileImage;
    if (!imageUrl) return '';
    const base = this.normalizeImageUrl(imageUrl);
    if (!base.includes('res.cloudinary.com')) return '';
    return [110, 220, 330]
      .map((size) => `${this.normalizeImageUrl(imageUrl, size, size)} ${size}w`)
      .join(', ');
  }

  getGallerySrcSet(imageUrl: string): string {
    if (!imageUrl) return '';
    const base = this.normalizeImageUrl(imageUrl);
    if (!base.includes('res.cloudinary.com')) return '';
    return [240, 360, 480]
      .map((size) => `${this.normalizeImageUrl(imageUrl, size, size)} ${size}w`)
      .join(', ');
  }

  get mainHeadline(): string {
    const name = String(this.photographer?.name || '').trim() || 'Photographer';
    const parts: string[] = [];
    if (Array.isArray(this.photographer?.skills) && this.photographer.skills.length) {
      parts.push(this.photographer.skills.slice(0, 3).join(' · '));
    }
    if (this.photographer?.location?.state) {
      parts.push(this.photographer.location.state);
    }
    return [name, ...parts].filter(Boolean).join(' · ');
  }

  get displayUsername(): string {
    return String(this.photographer?.username || this.photographer?.userName || '').trim();
  }

  get totalPricingEnabled(): number {
    return (this.photographer?.pricing || []).filter((p: any) => p?.enabled).length;
  }

  get enabledPricing(): any[] {
    return (this.photographer?.pricing || []).filter((p: any) => p?.enabled);
  }

  get startingPriceEntry(): any {
    return (this.photographer?.pricing || []).find((p: any) => p?.name === 'Starting Price' && p?.enabled);
  }

  get socialPlatforms(): any[] {
    return Array.isArray(this.photographer?.socialMedia) ? this.photographer.socialMedia : [];
  }

  get canOpenSocialProfiles(): boolean {
    return !!this.photographer && this.photographer.socialMediaRestricted !== true;
  }

  get hasMainSocialLink(): boolean {
    return this.getMainSocialLink() !== '#';
  }

  get locationLabel(): string {
    const parts = [this.photographer?.location?.district, this.photographer?.location?.state].filter(Boolean);
    return parts.join(', ') || '—';
  }

  getSkillChips(): string[] {
    return Array.isArray(this.photographer?.skills) ? this.photographer.skills : [];
  }

  getEquipmentChips(): string[] {
    return Array.isArray(this.photographer?.equipment) ? this.photographer.equipment : [];
  }

  getSocialIcon(platform: string): string {
    const p = String(platform || '').toLowerCase();
    if (p.includes('youtube')) return 'bi-youtube';
    if (p.includes('instagram')) return 'bi-instagram';
    if (p.includes('facebook')) return 'bi-facebook';
    if (p.includes('tiktok')) return 'bi-tiktok';
    if (p.includes('twitter') || p.includes('x')) return 'bi-twitter-x';
    if (p.includes('linkedin')) return 'bi-linkedin';
    return 'bi-globe';
  }

  getSocialUrl(sm: any): string {
    return buildSocialProfileUrl(sm?.platform || '', sm?.handle) || sm?.url || '#';
  }

  getMainSocialLink(): string {
    if (!this.canOpenSocialProfiles) return '#';
    const first = this.socialPlatforms[0];
    return first ? this.getSocialUrl(first) : '#';
  }

  onFollowClick(): void {
    const first = this.socialPlatforms[0] || null;
    this.trackSocialClick(first, this.getMainSocialLink(), 'photographer_profile_follow');
  }

  onPlatformClick(sm: any): void {
    this.trackSocialClick(sm, this.getSocialUrl(sm), 'photographer_profile_platform');
  }

  private trackSocialClick(sm: any, url: string, source: string): void {
    if (!this.isLoggedIn || !this.canOpenSocialProfiles || !this.photographer?._id) return;
    if (!url || url === '#') return;
    const platform = String(sm?.platform || 'website').trim() || 'website';
    this.socialClickTracker.track({
      targetUserId: String(this.photographer._id),
      targetRole: 'photographer',
      platform,
      url,
      source,
    });
  }

  getPrimaryTier(): string {
    const tier = String(this.socialPlatforms[0]?.tier || '').trim();
    return tier ? tier.toUpperCase() : '';
  }

  getPlatformLabel(sm: any): string {
    return String(sm?.platform || 'Platform');
  }

  getPriceLabel(item: any): string {
    const key = String(item?.name || '').trim();
    if (!key) return 'Rate';
    return this.pricingLabelMap[key] || item?.label || key;
  }

  onContactClick(): void {
    this.showContact = true;
    if (typeof document !== 'undefined') {
      const el = document.getElementById('photographer-contact');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  stripProtocol(url: string): string {
    return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  onImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('assets/default-profile.png')) {
      img.src = 'assets/default-profile.png';
    }
  }

  private optimizeCloudinaryUrl(url: string, width?: number, height?: number): string {
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    const [prefix, suffix] = url.split('/upload/');
    if (!prefix || !suffix) return url;

    const transforms = ['f_auto', 'q_auto', 'dpr_auto'];
    if (typeof width === 'number' && width > 0) transforms.push(`w_${Math.round(width)}`);
    if (typeof height === 'number' && height > 0) {
      transforms.push(`h_${Math.round(height)}`);
      transforms.push('c_fill');
    }

    return `${prefix}/upload/${transforms.join(',')}/${suffix}`;
  }

  private normalizeImageUrl(url?: string | null, width?: number, height?: number): string {
    if (!url) return '';
    if (url.startsWith('/assets/') || url.startsWith('/assets')) {
      const api = environment.apiBaseUrl || '';
      const backend = api.replace(/\/api\/?$/, '') || api.replace(/\/api$/, '');
      return backend ? backend + url : url;
    }
    return this.optimizeCloudinaryUrl(url, width, height);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private config: ConfigService,
    private socialClickTracker: SocialClickTrackerService,
    private session: SessionService,
    private visibility: VisibilityService,
    private cd: ChangeDetectorRef,
    private titleService: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.config.getPricingOptions().subscribe({
      next: (options: any[]) => {
        const list = Array.isArray(options) ? options : [];
        this.pricingLabelMap = list.reduce((acc: Record<string, string>, option: any) => {
          const key = String(option?.key || '').trim();
          const label = String(option?.label || '').trim();
          if (key && label) {
            acc[key] = label;
          }
          return acc;
        }, {});
        if (!Object.keys(this.pricingLabelMap).length) {
          this.pricingLabelMap = { ...this.fallbackPricingLabelMap };
        }
        this.cd.detectChanges();
      },
      error: () => {
        this.pricingLabelMap = { ...this.fallbackPricingLabelMap };
      },
    });

    this.route.paramMap.subscribe(() => {
      const username = this.route.snapshot.paramMap.get('username') || this.route.parent?.snapshot.paramMap.get('username') || '';
      this.photographer = null;
      this.error = '';
      this.loading = true;

      if (!username) {
        this.error = 'No photographer specified.';
        this.loading = false;
        this.setDefaultMetadata();
        this.cd.detectChanges();
        return;
      }

      this.config.getPhotographerByUsername(username).subscribe({
        next: (data: any) => {
          if (!data) {
            this.photographer = null;
            this.error = 'Photographer not found.';
            this.setDefaultMetadata();
          } else {
            this.photographer = data;
            this.updateMetadata(data);
            this.ensureCanonicalProfileUrl(data, username);
          }
          this.loading = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.photographer = null;
          this.error = 'Photographer not found.';
          this.setDefaultMetadata();
          this.loading = false;
          this.cd.detectChanges();
        },
      });
    });
  }

  private updateMetadata(photographer: any): void {
    const name = String(photographer?.name || '').trim() || 'Photographer';
    const skills = Array.isArray(photographer?.skills) ? photographer.skills.slice(0, 3).join(', ') : '';
    const title = `${name} | Photographer | TrendStarz`;
    const description = `Discover ${name}${skills ? ` (${skills})` : ''} on TrendStarz. View skills, pricing, equipment, and verified social presence.`;
    const canonicalKey = String(photographer?.username || photographer?._id || '').trim();
    const canonical = `https://trendstarz.in/photographer/${canonicalKey}`;

    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
    this.meta.updateTag({ property: 'og:type', content: 'profile' });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.updateCanonical(canonical);

    if (isPlatformBrowser(this.platformId)) {
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag?.('config', 'G-5912TSJYW5', {
        send_page_view: false,
        page_title: title,
        page_path: `/photographer/${canonicalKey}`,
        photographer_name: name,
        photographer_skills: skills,
      });
    }
  }

  private setDefaultMetadata(): void {
    const title = 'Photographer Profile | TrendStarz';
    const description = 'View photographer and videographer profile details on TrendStarz.';
    this.titleService.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  private updateCanonical(href: string): void {
    let canonical = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', href);
  }

  private ensureCanonicalProfileUrl(photographer: any, requestedKey: string): void {
    const username = String(photographer?.username || '').trim();
    if (!username) return;
    if (String(requestedKey || '').trim() === username) return;
    this.router.navigate(['/photographer', username], { replaceUrl: true });
  }
}
