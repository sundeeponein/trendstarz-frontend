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
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Could not load photographer dashboard.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
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
    const id = this.photographer?._id;
    if (id) {
      this.router.navigate(['/photographer', id]);
    }
  }

  onSearch(): void {
    this.router.navigate(['/search']);
  }
}
