import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ConfigService } from '../../config.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../../core/session.service';
import { VisibilityService } from '../../../core/visibility.service';
import { WriteReviewComponent } from '../../write-review/write-review.component';
import { ReviewListComponent } from '../../review-list/review-list.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-influencer-profile-view',
  standalone: true,
  imports: [CommonModule, RouterModule, WriteReviewComponent, ReviewListComponent],
  templateUrl: './influencer-profile-view.component.html',
  styleUrls: ['./influencer-profile-view.component.scss']
})
export class InfluencerProfileViewComponent implements OnInit {
  influencer: any;
  loading = true;
  error = '';
  showContactInfo = false;

  /** Active social media platform tab index. */
  activePlatformIdx = 0;

  // Review state
  showWriteReview = false;
  /** Completed invite ID for this influencer—brand needs one to write a review */
  completedInviteId: string | null = null;
  completedInviteLoading = false;

  /** Whether the logged-in viewer has a Pro subscription */
  get isProViewer(): boolean {
    return this.visibility.isPro();
  }

  get isFreeViewer(): boolean {
    return this.visibility.isFree();
  }

  get isGuestViewer(): boolean {
    return this.visibility.isGuest();
  }

  /** Whether any user is logged in (used to gate contact details for guests) */
  get isLoggedIn(): boolean {
    return this.visibility.isLoggedIn();
  }

  get isBrandViewer(): boolean {
    const user = this.session.getUser();
    return user?.role === 'BRAND' || user?.role === 'brand';
  }

  get canViewContactDetails(): boolean {
    return !!this.influencer && this.influencer.contactRestricted !== true;
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

  private normalizeImageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('/assets/') || url.startsWith('/assets')) {
      const api = environment.apiBaseUrl || '';
      const backend = api.replace(/\/api\/?$/, '') || api.replace(/\/api$/, '');
      return backend ? backend + url : url;
    }
    return url;
  }

  get displayImage(): string {
    const imageUrl = this.influencer?.profileImage || this.influencer?.profileImages?.[0]?.url;
    return this.normalizeImageUrl(imageUrl) || 'assets/default-profile.png';
  }

  get galleryImages(): string[] {
    const raw = Array.isArray(this.influencer?.profileImages) ? this.influencer.profileImages : [];
    const normalized = raw
      .map((entry: any) => this.normalizeImageUrl(typeof entry === 'string' ? entry : entry?.url))
      .filter((url: string) => !!url);
    const unique: string[] = Array.from(new Set<string>(normalized));
    if (!unique.length && this.displayImage && this.displayImage !== 'assets/default-profile.png') {
      unique.push(this.displayImage);
    }
    return unique;
  }

  getTotalFollowers(): number {
    return (this.influencer?.socialMedia || []).reduce((sum: number, sm: any) => sum + (Number(sm.followersCount) || 0), 0);
  }

  get displayTags(): string[] {
    const hiddenCommissionTags = new Set(['early access', 'partner', 'internal/test', 'internal test']);
    return Array.isArray(this.influencer?.adminTags)
      ? this.influencer.adminTags
          .filter((tag: any) => !!String(tag || '').trim())
          .filter((tag: any) => !hiddenCommissionTags.has(String(tag || '').trim().toLowerCase()))
      : [];
  }

  getPrimaryTier(): string {
    const list: any[] = this.influencer?.socialMedia || [];
    return list[0]?.tier || list.find((sm: any) => sm?.tier)?.tier || '';
  }

  formatFollowers(count: number): string {
    if (!count) return '—';
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  }

  getSmTotal(sm: any): number {
    return (sm.contentTypes || []).reduce((sum: number, ct: any) => sum + (Number(ct.price) || 0), 0);
  }

  getSocialIcon(sm: any): string {
    const p = (sm?.platform || '').toLowerCase();
    if (p.includes('insta')) return 'bi bi-instagram';
    if (p.includes('youtube')) return 'bi bi-youtube';
    if (p.includes('face')) return 'bi bi-facebook';
    if (p.includes('twitter') || p.includes('x')) return 'bi bi-twitter-x';
    if (p.includes('tiktok')) return 'bi bi-tiktok';
    if (p.includes('linkedin')) return 'bi bi-linkedin';
    return 'bi bi-globe';
  }

  getFollowerLabel(sm: any): string {
    const p = (sm?.platform || '').toLowerCase();
    return p.includes('youtube') ? 'subscribers' : 'followers';
  }

  getSocialUrl(sm: any): string {
    const p = (sm?.platform || '').toLowerCase();
    const handle = sm?.handle || '';
    if (p.includes('insta')) return 'https://instagram.com/' + handle;
    if (p.includes('youtube')) return 'https://youtube.com/' + handle;
    if (p.includes('face')) return 'https://facebook.com/' + handle;
    if (p.includes('twitter') || p.includes('x')) return 'https://x.com/' + handle;
    if (p.includes('tiktok')) return 'https://tiktok.com/@' + handle;
    if (p.includes('linkedin')) return 'https://linkedin.com/in/' + handle;
    return sm?.url || '#';
  }

  tagBadgeClass(tag: string): string {
    const normalized = String(tag || '').toLowerCase();
    if (normalized.includes('founder')) return 'tag-badge--founder';
    if (normalized.includes('verified')) return 'tag-badge--verified';
    if (normalized.includes('internal')) return 'tag-badge--internal';
    return 'tag-badge--neutral';
  }

  getMainSocialLink(): string {
    if (this.influencer?.socialMedia?.length) {
      return this.getSocialUrl(this.influencer.socialMedia[0]);
    }
    return '#';
  }

  getAvgEngagement(): string {
    const sms = this.influencer?.socialMedia || [];
    const rates = sms
      .filter((sm: any) => sm.engagementRate)
      .map((sm: any) => Number(sm.engagementRate));
    if (!rates.length) return '—';
    const avg = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;
    return avg.toFixed(1) + '%';
  }

  get primaryAgeRange(): string {
    const ageRange =
      this.influencer?.audienceDemographics?.ageRange ||
      this.influencer?.ageRange ||
      '';
    return String(ageRange || '').trim();
  }

  onContactClick(): void {
    this.showContactInfo = true;
    if (typeof document !== 'undefined') {
      const el = document.getElementById('influencer-contact-info');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  constructor(
    private route: ActivatedRoute,
    private config: ConfigService,
    private cd: ChangeDetectorRef,
    private session: SessionService,
    private visibility: VisibilityService,
    private titleService: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const username = params.get('username');
      this.influencer = null;
      this.error = '';
      this.loading = true;
      if (username) {
        this.config.getInfluencerByUsername(username).subscribe({
          next: (data) => {
            this.influencer = data || null;
            if (!data) {
              this.error = 'Influencer not found.';
              this.setDefaultMetadata();
            }
            if (data) {
              this.updateMetadata(data);
              this.config.trackInfluencerProfileImpression(username).subscribe({
                next: () => {},
                error: () => {}
              });
            }
            this.loading = false;
            this.cd.detectChanges();
            // Brand: try to find a completed invite to enable review button
            if (data && this.isBrandViewer && this.isProViewer) {
              this.loadCompletedInvite(data._id);
            }
          },
          error: () => {
            this.error = 'Could not load influencer profile.';
            this.loading = false;
            this.setDefaultMetadata();
            this.cd.detectChanges();
          }
        });
      } else {
        this.error = 'No influencer username provided.';
        this.loading = false;
        this.setDefaultMetadata();
        this.cd.detectChanges();
      }
    });
  }

  private updateMetadata(influencer: any): void {
    const name = String(influencer?.name || '').trim() || 'Creator';
    const categories = Array.isArray(influencer?.categories)
      ? influencer.categories.slice(0, 2).join(', ')
      : '';
    const followers = this.formatFollowers(this.getTotalFollowers());
    const title = `${name}${categories ? ' - ' + categories : ''} | Influencer | TrendStarz`;
    const description = `Discover ${name}${categories ? ' (' + categories + ')' : ''} on TrendStarz. ${followers} followers. Contact for collaborations, campaigns, and brand partnerships.`;
    const canonical = `https://trendstarz.in/influencer/${influencer?.username || ''}`;

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
        page_path: `/influencer/${influencer?.username}`,
        creator_name: name,
        creator_categories: categories,
      });
    }
  }

  private setDefaultMetadata(): void {
    const title = 'Influencer Profile | TrendStarz';
    const description = 'View influencer profile details and collaboration highlights on TrendStarz.';
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

  loadCompletedInvite(influencerId: string) {
    this.completedInviteLoading = true;
    // Ask the backend: does this brand have a completed invite with this influencer?
    this.config.getCompletedInviteWithInfluencer(influencerId).subscribe({
      next: (invite: any) => {
        this.completedInviteId = invite?._id ?? null;
        this.completedInviteLoading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.completedInviteLoading = false;
      },
    });
  }
}

