import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../../config.service';
import { SessionService } from '../../../core/session.service';
import { switchMap } from 'rxjs/operators';
import { Campaign } from '../../campaigns/campaign.model';
import { CampaignListComponent } from '../../campaigns/campaign-list/campaign-list.component';
import { WriteReviewComponent } from '../../write-review/write-review.component';
import { ReviewListComponent } from '../../review-list/review-list.component';

@Component({
  selector: 'app-brand-profile-view',
  standalone: true,
  imports: [CommonModule, CampaignListComponent, WriteReviewComponent, ReviewListComponent],
  templateUrl: './brand-profile-view.component.html',
  styleUrls: ['./brand-profile-view.component.scss']
})
export class BrandProfileViewComponent implements OnInit {
  brand: any = null;
  loading = true;
  error = '';
  showContact = false;
  activeTab: 'overview' | 'campaigns' | 'analytics' = 'overview';
  campaigns: Campaign[] = [];
  isOwner = false;

  // Review state
  showWriteReview = false;
  completedInviteId: string | null = null;

  get isInfluencerViewer(): boolean {
    const user = this.session.getUser();
    return user?.role === 'INFLUENCER' || user?.role === 'influencer';
  }

  get isProViewer(): boolean {
    return !!this.session.getUser()?.isPremium;
  }

  stripProtocol(url: string): string {
    return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }

  get displayImage(): string {
    return this.brand?.brandLogo?.[0]?.url
      || (typeof this.brand?.brandLogo === 'string' ? this.brand.brandLogo : null)
      || 'assets/default-profile.png';
  }

  getTotalFollowers(): number {
    return (this.brand?.socialMedia || []).reduce((sum: number, sm: any) => sum + (sm.followersCount || 0), 0);
  }

  formatFollowers(count: number): string {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return count.toString();
  }

  getFollowerPercent(sm: any): number {
    const total = this.getTotalFollowers();
    if (!total) return 0;
    return Math.round(((sm.followersCount || 0) / total) * 100);
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

  getSocialLabel(sm: any): string {
    const p = (sm?.platform || '').toLowerCase();
    if (p.includes('insta')) return 'Instagram';
    if (p.includes('youtube')) return 'YouTube';
    if (p.includes('face')) return 'Facebook';
    if (p.includes('twitter') || p.includes('x')) return 'Twitter';
    if (p.includes('tiktok')) return 'TikTok';
    if (p.includes('linkedin')) return 'LinkedIn';
    return sm?.platform || 'Website';
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
    if (this.brand?.socialMedia?.length) {
      return this.getSocialUrl(this.brand.socialMedia[0]);
    }
    return '#';
  }

  constructor(private route: ActivatedRoute, private config: ConfigService, private session: SessionService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const brandName = params.get('brandName');
          this.brand = null;
          this.error = '';
          this.loading = true;
          if (brandName) {
            return this.config.getBrandByName(brandName);
          } else {
            this.error = 'No brand specified';
            this.loading = false;
            this.cd.detectChanges();
            return [];
          }
        })
      )
      .subscribe({
        next: (data: any) => {
          if (!data) {
            this.error = 'Brand not found.';
            this.brand = null;
          } else {
            this.brand = data;
            const routeBrandName = this.route.snapshot.paramMap.get('brandName');
            if (routeBrandName) {
              this.config.trackBrandProfileImpression(routeBrandName).subscribe({
                next: () => {},
                error: () => {}
              });
            }
            this.checkOwnership(data);
            // Fetch campaigns for this brand
            const brandName = data.brandName || data.brandUsername || data.name;
            if (brandName) {
              this.config.getCampaignsByBrandName(brandName).subscribe({
                next: (campaigns: any[]) => {
                  this.campaigns = campaigns;
                  this.cd.detectChanges();
                }
              });
            }
            // Influencer premium: find their completed invite with this brand
            if (this.isInfluencerViewer && this.isProViewer) {
              this.config.getMyInvites().subscribe({
                next: (invites: any[]) => {
                  const done = invites.find(
                    (inv: any) => inv.status === 'completed'
                      && (String(inv.brandId?._id || inv.brandId) === String(data._id)
                        || String(inv.brandId?._id || inv.brandId) === (data.brandUsername || ''))
                  );
                  this.completedInviteId = done?._id || null;
                  this.cd.detectChanges();
                },
                error: () => {}
              });
            }
          }
          this.loading = false;
          this.cd.detectChanges();
        },
        error: (err: any) => {
          console.error('Brand API error:', err);
          this.error = 'Could not load brand profile.';
          this.loading = false;
          this.cd.detectChanges();
        }
      });
  }

  private checkOwnership(brand: any) {
    const user = this.session.getUser();
    if (!user) { this.isOwner = false; return; }
    this.isOwner = user.id === brand._id || user.id === brand.userId || user.email === brand.email;
  }

  onCreateCampaign(data: Partial<Campaign>) {
    const brandId = this.brand?._id;
    if (!brandId) return;
    const payload: any = { ...data, brandId };
    this.config.createCampaign(payload).subscribe({
      next: (created: Campaign) => {
        this.campaigns = [...this.campaigns, created];
        this.cd.detectChanges();
      }
    });
  }

  onEditCampaign(event: { id: string; data: Partial<Campaign> }) {
    this.config.updateCampaign(event.id, event.data).subscribe({
      next: (updated: Campaign) => {
        this.campaigns = this.campaigns.map(c => c._id === event.id ? { ...c, ...updated } : c);
        this.cd.detectChanges();
      }
    });
  }

  onDeleteCampaign(id: string) {
    this.config.deleteCampaign(id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter(c => c._id !== id);
        this.cd.detectChanges();
      }
    });
  }
}
