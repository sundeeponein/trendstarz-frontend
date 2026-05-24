import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';

@Component({
  selector: 'app-photographer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './photographer-dashboard.component.html',
  styleUrls: ['./photographer-dashboard.component.scss'],
})
export class PhotographerDashboardComponent implements OnInit, OnDestroy {
  photographer: any = null;
  brandCampaigns: any[] = [];
  brandCampaignsLoading = false;
  brandInvites: any[] = [];
  brandInvitesLoading = false;
  loading = true;
  error = '';
  profileIncomplete = false;
  profileTraffic = {
    impressions: 0,
    clicks: 0,
    lastImpressionAt: '',
    lastClickAt: '',
  };
  private loadedOnce = false;

  private readonly userSub = new Subscription();

  constructor(
    private readonly session: SessionService,
    private readonly config: ConfigService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!this.session.getUser()) {
      this.session.loadUserFromStorage();
    }

    this.userSub.add(
      this.session.user$.subscribe((user) => {
        if (!user || String(user.role || '').toLowerCase() !== 'photographer') {
          return;
        }
        if (this.loadedOnce) {
          return;
        }
        this.loadedOnce = true;
        this.loadDashboard();
      }),
    );
  }

  ngOnDestroy(): void {
    this.userSub.unsubscribe();
  }

  get skillsCount(): number {
    return Array.isArray(this.photographer?.skills) ? this.photographer.skills.length : 0;
  }

  get pricingCount(): number {
    return Array.isArray(this.photographer?.pricing)
      ? this.photographer.pricing.filter((item: any) => item?.enabled).length
      : 0;
  }

  get platformsCount(): number {
    return Array.isArray(this.photographer?.socialMedia) ? this.photographer.socialMedia.length : 0;
  }

  get equipmentCount(): number {
    return Array.isArray(this.photographer?.equipment) ? this.photographer.equipment.length : 0;
  }

  get trafficCardTitle(): string {
    return this.photographer?.status === 'accepted' ? 'Profile traffic' : 'Profile traffic pending';
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = '';
    this.config.getPhotographerProfileById().subscribe({
      next: (profile: any) => {
        if (!profile) {
          this.photographer = null;
          this.error = 'Could not load photographer dashboard.';
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        this.photographer = profile;
        this.profileTraffic = {
          impressions: Number(profile?.profileTraffic?.impressions || 0),
          clicks: Number(profile?.profileTraffic?.clicks || 0),
          lastImpressionAt: profile?.profileTraffic?.lastImpressionAt || '',
          lastClickAt: profile?.profileTraffic?.lastClickAt || '',
        };
        this.profileIncomplete = !profile?.name || !profile?.location?.state || !Array.isArray(profile?.skills) || profile.skills.length === 0 || !Array.isArray(profile?.socialMedia) || profile.socialMedia.length === 0;
        this.loading = false;
        this.loadBrandInvites();
        this.loadBrandCampaigns();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Could not load photographer dashboard.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadBrandCampaigns(): void {
    this.brandCampaignsLoading = true;
    this.config.getAllCampaigns('active').subscribe({
      next: (rows: any[]) => {
        const all = Array.isArray(rows) ? rows : [];
        // Show latest active campaigns from brands for quick discovery.
        this.brandCampaigns = all
          .filter((c: any) => String(c?.status || '').toLowerCase() === 'active')
          .sort((a: any, b: any) => {
            const at = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
            const bt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
            return bt - at;
          })
          .slice(0, 6);
        this.brandCampaignsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.brandCampaigns = [];
        this.brandCampaignsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadBrandInvites(): void {
    this.brandInvitesLoading = true;
    this.config.getMyPhotographerInvites().subscribe({
      next: (rows: any[]) => {
        this.brandInvites = Array.isArray(rows) ? rows : [];
        this.brandInvitesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.brandInvites = [];
        this.brandInvitesLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  getBrandName(campaign: any): string {
    const b = campaign?.brandId;
    if (typeof b === 'object' && b) {
      return b.brandName || b.businessName || b.name || 'Brand';
    }
    return 'Brand';
  }

  formatTimeline(start?: string, end?: string): string {
    const fmt = (d?: string) => d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : '?';
    return `${fmt(start)} – ${fmt(end)}`;
  }

  formatDate(value: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  onCompleteProfile(): void {
    this.router.navigate(['/photographer-profile']);
  }

  onViewPublicProfile(): void {
    const username = String(this.photographer?.username || '').trim();
    const id = this.photographer?._id;
    if (username) {
      this.router.navigate(['/photographer', username]);
      return;
    }
    if (id) {
      this.router.navigate(['/photographer', id]);
    }
  }

  onSearch(): void {
    this.router.navigate(['/search']);
  }

  onOpenCampaigns(): void {
    this.router.navigate(['/campaigns']);
  }
}
