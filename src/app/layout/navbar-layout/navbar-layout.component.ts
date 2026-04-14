import { Component, ChangeDetectorRef } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { FooterComponent } from '../../shared/footer/footer.component';

@Component({
  selector: 'app-navbar-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FooterComponent],
  templateUrl: './navbar-layout.component.html',
  styleUrl: './navbar-layout.component.scss'
})
export class NavbarLayoutComponent {
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
          const updated = { ...this.session.getUser(), isPremium: !!profile.isPremium, premiumEnd: profile.premiumEnd || null };
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
          return this.user.brandLogo[0].url;
        }
      } else if (this.user.profileImage && typeof this.user.profileImage === 'string') {
        // For others, use profileImage
        if (/^https?:\/\//.test(this.user.profileImage)) {
          return this.user.profileImage;
        }
      }
    }
    return 'assets/default-profile.png';
  }
  constructor(private router: Router, private session: SessionService, private config: ConfigService, private cdr: ChangeDetectorRef) {
    // Subscribe to user changes
    this.session.user$.subscribe(user => {
      this.user = user;
    });
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

  isWelcomePage(): boolean {
    // Checks if the current route is the root (welcome page)
    return this.router.url === '/' || this.router.url === '/welcome';
  }
}
