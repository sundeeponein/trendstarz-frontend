import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../../config.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../../core/session.service';
import { WriteReviewComponent } from '../../write-review/write-review.component';
import { ReviewListComponent } from '../../review-list/review-list.component';

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
    return !!this.session.getUser()?.isPremium;
  }

  /** Whether any user is logged in (used to gate contact details for guests) */
  get isLoggedIn(): boolean {
    return !!this.session.getUser();
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

  get displayImage(): string {
    return this.influencer?.profileImage || this.influencer?.profileImages?.[0]?.url || 'assets/default-profile.png';
  }

  getTotalFollowers(): number {
    return (this.influencer?.socialMedia || []).reduce((sum: number, sm: any) => sum + (Number(sm.followersCount) || 0), 0);
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
    private session: SessionService
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
            if (!data) this.error = 'Influencer not found.';
            if (data) {
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
            this.cd.detectChanges();
          }
        });
      } else {
        this.error = 'No influencer username provided.';
        this.loading = false;
        this.cd.detectChanges();
      }
    });
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

