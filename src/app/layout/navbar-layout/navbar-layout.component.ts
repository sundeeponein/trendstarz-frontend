import { Component, ChangeDetectorRef, HostListener, OnDestroy } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavigationStart, Router } from '@angular/router';
import { FooterComponent } from '../../shared/footer/footer.component';
import { ImageGuidelinesModalComponent } from '../../shared/components/image-guidelines-modal/image-guidelines-modal.component';
import { environment } from '../../../environments/environment';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FooterComponent, ImageGuidelinesModalComponent],
  templateUrl: './navbar-layout.component.html',
  styleUrl: './navbar-layout.component.scss'
})
export class NavbarLayoutComponent implements OnDestroy {
  mobileMenuOpen = false;
  mobileProfileMenuOpen = false;
  notificationsOpen = false;
  notifications: any[] = [];
  unreadNotificationCount = 0;
  private readonly subs = new Subscription();
  private readonly commissionBadgeMap: Record<string, string> = {
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
  private appLinkVisibility = {
    showSearchLink: true,
    showRegisterInfluencerLink: true,
    showRegisterBrandLink: true,
    showRegisterPhotographerLink: true,
  };

  private loadAppLinkVisibility(): void {
    this.config.getAppSettings().subscribe((settings: any) => {
      this.appLinkVisibility = {
        showSearchLink: settings?.showSearchLink !== false,
        showRegisterInfluencerLink: settings?.showRegisterInfluencerLink !== false,
        showRegisterBrandLink: settings?.showRegisterBrandLink !== false,
        showRegisterPhotographerLink: settings?.showRegisterPhotographerLink !== false,
      };
      this.cdr.detectChanges();
    });
  }

  private setMobileMenuState(open: boolean) {
    this.mobileMenuOpen = open;
    if (!open) {
      this.mobileProfileMenuOpen = false;
    }
    if (typeof document !== 'undefined') {
      const body = document.body;
      if (open) {
        body.style.overflow = 'hidden';
        body.style.touchAction = 'none';
      } else {
        body.style.removeProperty('overflow');
        body.style.removeProperty('touch-action');
      }
    }
  }

  get displayName(): string {
    if (!this.user) return '';
    return this.user.name || this.user.fullname || this.user.brandName || this.user.email || 'User';
  }

  get searchLabel(): string {
    if (this.user?.role === 'influencer') return 'Search';
    return 'Search';
  }

  get isAdminUser(): boolean {
    return String(this.user?.role || '').toLowerCase() === 'admin';
  }

  get showSearchLink(): boolean {
    return !this.isAdminUser && this.appLinkVisibility.showSearchLink;
  }

  get showRegisterLinks(): boolean {
    return !this.user;
  }

  get showRegisterInfluencerLink(): boolean {
    return this.showRegisterLinks && this.appLinkVisibility.showRegisterInfluencerLink;
  }

  get showRegisterBrandLink(): boolean {
    return this.showRegisterLinks && this.appLinkVisibility.showRegisterBrandLink;
  }

  get showRegisterPhotographerLink(): boolean {
    return this.showRegisterLinks && this.appLinkVisibility.showRegisterPhotographerLink;
  }

  get searchTooltip(): string {
    if (this.user?.role === 'brand') return 'Search influencers';
    if (this.user?.role === 'influencer') return 'Search brands';
    return 'Search influencers';
  }

  get isPhotographerCampaignsNavActive(): boolean {
    if (this.user?.role !== 'photographer') return false;
    return this.router.url.startsWith('/campaigns') && !this.router.url.includes('view=collaborations');
  }

  get isPhotographerCollaborationsNavActive(): boolean {
    if (this.user?.role !== 'photographer') return false;
    return this.router.url.startsWith('/campaigns') && this.router.url.includes('view=collaborations');
  }

  get isInfluencerCampaignsNavActive(): boolean {
    if (this.user?.role !== 'influencer') return false;
    return this.router.url.startsWith('/campaigns') && !this.router.url.includes('tab=collaborations');
  }

  get isInfluencerCollaborationsNavActive(): boolean {
    if (this.user?.role !== 'influencer') return false;
    return this.router.url.startsWith('/campaigns') && this.router.url.includes('tab=collaborations');
  }

  get commissionBadgeLabel(): string {
    const badge = String(this.user?.commissionBadge || '').trim();
    if (badge && this.commissionBadgeMap[badge]) return this.commissionBadgeMap[badge];
    const tags = Array.isArray(this.user?.adminTags) ? this.user.adminTags : [];
    const tag = tags.find((value: any) => {
      const normalized = String(value || '').trim();
      return !!normalized && (this.commissionBadgeMap[normalized] || ['Early Access', 'Partner', 'Internal/Test'].includes(normalized));
    });
    if (!tag) return '';
    const normalized = String(tag || '').trim();
    return this.commissionBadgeMap[normalized] || normalized;
  }

  get hasCommissionBadge(): boolean {
    return !!this.commissionBadgeLabel;
  }

  get commissionBadgeClass(): string {
    const label = this.commissionBadgeLabel.toLowerCase();
    if (label.includes('partner')) return 'commission-badge--partner';
    if (label.includes('internal')) return 'commission-badge--internal';
    return 'commission-badge--early';
  }
  ngOnInit() {
    this.loadAppLinkVisibility();

    // Sync isPremium from the live profile API into the session
    // so the navbar always reflects the correct plan status without requiring re-login
    const user = this.session.getUser();
    if (user) {
      const profileCall = user.role === 'brand'
        ? this.config.getBrandProfileById()
        : user.role === 'photographer'
          ? this.config.getPhotographerProfileById()
          : this.config.getInfluencerProfileById();
      profileCall.subscribe((profile: any) => {
        if (profile) {
          const updated = {
            ...this.session.getUser(),
            isPremium: !!profile.isPremium,
            premiumEnd: profile.premiumEnd || null,
            profileImages: profile.profileImages || this.session.getUser()?.profileImages,
            brandLogo: profile.brandLogo || this.session.getUser()?.brandLogo,
            name: profile.name || this.session.getUser()?.name,
            brandName: profile.brandName || this.session.getUser()?.brandName,
            profileImage: profile.profileImage || this.session.getUser()?.profileImage,
            adminTags: profile.adminTags || this.session.getUser()?.adminTags || [],
            commissionBadge: profile.commissionBadge || this.session.getUser()?.commissionBadge || null,
          };
          this.session.setUser(updated);
          this.cdr.detectChanges();
        }
      });

      this.refreshNotifications();
      this.refreshNotificationCount();
    }
  }

  get validProfileImage(): string {
    if (this.user) {
      // For brands, check brandLogo array
      if (this.user.role === 'brand') {
        if (Array.isArray(this.user.brandLogo) && this.user.brandLogo.length > 0 && this.user.brandLogo[0]?.url) {
          return this.normalizeImageUrl(this.user.brandLogo[0].url);
        }
      } else {
        // Influencers: profileImages[0].url is the canonical field; fall back to legacy profileImage string.
        if (Array.isArray(this.user.profileImages) && this.user.profileImages.length > 0 && this.user.profileImages[0]?.url) {
          return this.normalizeImageUrl(this.user.profileImages[0].url);
        }
        if (this.user.profileImage && typeof this.user.profileImage === 'string') {
          return this.normalizeImageUrl(this.user.profileImage);
        }
      }
    }
    return 'assets/default-profile.png';
  }

  private normalizeImageUrl(url: string): string {
    if (!url) return 'assets/default-profile.png';
    if (/^https?:\/\//.test(url)) return url;
    if (url.startsWith('/assets/')) {
      const api = environment.apiBaseUrl || '';
      const backend = api.replace(/\/api\/?$/, '');
      return backend ? backend + url : url;
    }
    return url;
  }
  constructor(private router: Router, private session: SessionService, private config: ConfigService, private cdr: ChangeDetectorRef) {
    // Subscribe to user changes
    this.subs.add(
      this.session.user$.subscribe(user => {
        this.user = user;
        this.loadAppLinkVisibility();
        if (!user) {
          this.notificationsOpen = false;
          this.notifications = [];
          this.unreadNotificationCount = 0;
        }
      }),
    );
    this.subs.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationStart))
        .subscribe(() => {
          this.closeMobileMenu();
          this.notificationsOpen = false;
        }),
    );
    // No need to call loadUserFromStorage here; handled in App root
  }
  logout() {
    this.session.clearSession();
    this.router.navigate(['/']);
  }
  user: any = null;
  dropdownOpen = false;

  // User is now managed reactively via SessionService

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  toggleMobileMenu() {
    this.setMobileMenuState(!this.mobileMenuOpen);
  }

  closeMobileMenu() {
    this.setMobileMenuState(false);
  }

  toggleMobileProfileMenu() {
    this.mobileProfileMenuOpen = !this.mobileProfileMenuOpen;
  }

  toggleNotifications() {
    if (!this.user) return;
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) {
      this.refreshNotifications();
      this.refreshNotificationCount();
    }
  }

  refreshNotifications() {
    this.subs.add(
      this.config.getMyNotifications(20).subscribe((items) => {
        this.notifications = Array.isArray(items) ? items : [];
        this.cdr.detectChanges();
      }),
    );
  }

  refreshNotificationCount() {
    this.subs.add(
      this.config.getUnreadNotificationsCount().subscribe((count) => {
        this.unreadNotificationCount = Number(count || 0);
        this.cdr.detectChanges();
      }),
    );
  }

  openNotification(item: any) {
    if (!item) return;
    if (!item.read) {
      this.subs.add(
        this.config.markNotificationRead(item._id).subscribe(() => {
          item.read = true;
          this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
          this.cdr.detectChanges();
        }),
      );
    }

    this.notificationsOpen = false;
    if (item.url) {
      this.router.navigateByUrl(item.url);
    }
  }

  markAllNotificationsRead() {
    this.subs.add(
      this.config.markAllNotificationsRead().subscribe(() => {
        this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
        this.unreadNotificationCount = 0;
        this.cdr.detectChanges();
      }),
    );
  }

  @HostListener('window:pageshow')
  onPageShow() {
    this.closeMobileMenu();
  }

  @HostListener('window:beforeunload')
  onBeforeUnload() {
    this.closeMobileMenu();
  }

  ngOnDestroy() {
    this.setMobileMenuState(false);
    this.subs.unsubscribe();
  }

  isWelcomePage(): boolean {
    // Checks if the current route is the root (welcome page)
    return this.router.url === '/' || this.router.url === '/welcome';
  }
}
