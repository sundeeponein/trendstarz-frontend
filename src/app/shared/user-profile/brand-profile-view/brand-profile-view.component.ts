import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../../config.service';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-brand-profile-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brand-profile-view.component.html',
  styleUrls: ['./brand-profile-view.component.scss']
})
export class BrandProfileViewComponent implements OnInit {
  brand: any = null;
  loading = true;
  error = '';
  showContact = false;
  activeTab: 'overview' | 'campaigns' | 'analytics' = 'overview';

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

  constructor(private route: ActivatedRoute, private config: ConfigService, private cd: ChangeDetectorRef) {}

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
}
