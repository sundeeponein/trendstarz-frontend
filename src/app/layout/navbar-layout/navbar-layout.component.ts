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
  private readonly subs = new Subscription();

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
  ngOnInit() {
    // Sync isPremium from the live profile API into the session
    // so the navbar always reflects the correct plan status without requiring re-login
    const user = this.session.getUser();
    if (user) {
      const profileCall = user.role === 'brand'
        ? this.config.getBrandProfileById()
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
          };
          this.session.setUser(updated);
          this.cdr.detectChanges();
        }
      });
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
      }),
    );
    this.subs.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationStart))
        .subscribe(() => this.closeMobileMenu()),
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
