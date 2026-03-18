import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../../config.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-influencer-profile-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './influencer-profile-view.component.html',
  styleUrls: ['./influencer-profile-view.component.scss']
})

export class InfluencerProfileViewComponent implements OnInit {
  influencer: any;
  loading = true;
  error = '';
  showContact = false;

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
    return (this.influencer?.socialMedia || []).reduce((sum: number, sm: any) => sum + (sm.followersCount || 0), 0);
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
    if (this.influencer?.socialMedia?.length) {
      return this.getSocialUrl(this.influencer.socialMedia[0]);
    }
    return '#';
  }

  constructor(private route: ActivatedRoute, private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const username = params.get('username');
      this.influencer = null;
      this.error = '';
      this.loading = true;
      if (username) {
        this.config.getInfluencerByUsername(username).subscribe({
          next: (data) => {
            if (!data) {
              this.error = 'Influencer not found.';
              this.influencer = null;
            } else {
              this.influencer = data;
            }
            this.loading = false;
            this.cd.detectChanges();
          },
          error: (err) => {
            console.error('Influencer API error:', err);
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
}
