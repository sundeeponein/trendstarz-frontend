import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize, timeout } from 'rxjs/operators';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { MonetizationApiService, UsageSummary } from '../../services/monetization-api.service';
import { CampaignDetailModalComponent } from '../../shared/campaign-detail-modal/campaign-detail-modal.component';
import { InviteAcceptPayload } from '../../shared/campaign-invite-card/campaign-invite-card.component';
import { DashboardService } from '../../services/dashboard.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ShippingAddressModalComponent } from '../../shared/components/shipping-address-modal/shipping-address-modal.component';
import { ShippingAddressModalService, ShippingAddress } from '../../shared/components/shipping-address-modal/shipping-address-modal.service';

@Component({
  selector: 'app-photographer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, CampaignDetailModalComponent, ShippingAddressModalComponent],
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
  usageSummary: UsageSummary | null = null;
  private loadedOnce = false;

  selectedInvite: any = null;
  selectedInviteManual = false;
  responding: string | null = null;

  private readonly userSub = new Subscription();

  constructor(
    private readonly session: SessionService,
    private readonly config: ConfigService,
    private readonly monetizationApi: MonetizationApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly dashboardService: DashboardService,
    private readonly toast: ToastService,
    private readonly shippingModal: ShippingAddressModalService,
  ) {}

  ngOnInit(): void {
    if (!this.session.getUser()) {
      this.session.loadUserFromStorage();
    }

    this.monetizationApi.getMyUsage().subscribe({
      next: (res) => {
        this.usageSummary = res?.usage || null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.usageSummary = null;
      },
    });

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

  openDetail(invite: any): void {
    this.selectedInvite = invite;
    this.selectedInviteManual = true;
    this.cdr.detectChanges();
  }

  closeDetail(): void {
    this.selectedInvite = null;
    this.selectedInviteManual = false;
    this.cdr.detectChanges();
  }

  onModalAccept(payload: InviteAcceptPayload): void {
    this.respond(
      payload.inviteId,
      payload.responseType === 'counter' ? 'counter_sent' : 'accepted',
      payload.postDate,
      payload.counterAmount,
      payload.counterMessage,
    );
  }

  onModalDecline(payload: { inviteId: string }): void {
    this.respond(payload.inviteId, 'declined');
  }

  onModalValidationError(_message: string): void {}

  private respond(
    inviteId: string,
    status: 'accepted' | 'declined' | 'counter_sent',
    selectedPostDate?: string,
    counterAmount?: number,
    counterMessage?: string,
  ): void {
    if (this.responding) return;

    const finish = (shippingAddress?: ShippingAddress) => {
      this.responding = inviteId;
      this.dashboardService.respondToInvite(
        inviteId,
        status,
        selectedPostDate,
        undefined,
        undefined,
        counterAmount,
        counterMessage,
        undefined,
        shippingAddress,
      ).pipe(
        timeout(20000),
        finalize(() => {
          this.responding = null;
          this.cdr.detectChanges();
        }),
      ).subscribe({
        next: () => {
          this.brandInvites = this.brandInvites.filter(i => i._id !== inviteId);
          if (this.selectedInvite?._id === inviteId) {
            this.selectedInvite = null;
            this.selectedInviteManual = false;
          }
          this.toast.success(
            status === 'accepted' ? 'Invite accepted!' :
            status === 'counter_sent' ? 'Counter offer sent!' : 'Invite declined.',
          );
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to respond to invite.');
          this.cdr.detectChanges();
        },
      });
    };

    const invite = this.brandInvites.find(i => i._id === inviteId) || this.selectedInvite;
    const campaignType = invite?.campaignId?.campaignType || invite?.campaignType || '';
    const needsShipping = status === 'accepted' && campaignType === 'product_gifting';

    if (needsShipping) {
      this.shippingModal.prompt({
        campaignTitle: invite?.campaignId?.title || invite?.title || '',
      }).then(
        (addr: ShippingAddress | null) => finish(addr ?? undefined),
        () => { this.responding = null; },
      );
    } else {
      finish();
    }
  }
}
