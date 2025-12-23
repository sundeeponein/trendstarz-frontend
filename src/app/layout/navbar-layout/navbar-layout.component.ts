import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar-layout.component.html'
})
export class NavbarLayoutComponent {
  get displayName(): string {
    if (!this.user) return '';
    return this.user.name || this.user.fullname || this.user.brandName || this.user.email || 'User';
  }
  ngOnInit() {
    // Debug log to trace user object
    setTimeout(() => {
      console.log('Navbar user:', this.user);
      // Extra debug: show raw token payload
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('Raw JWT payload:', payload);
        } catch (e) {
          console.log('Failed to parse JWT payload:', e);
        }
      }
    }, 500);
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
  constructor(private router: Router) {
    this.loadUser();
  }
  logout() {
    localStorage.removeItem('token');
    this.user = null;
    this.router.navigate(['/']);
  }
  user: any = null;
  dropdownOpen = false;

  loadUser() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        let profileImage = payload.profileImage || null;
        let brandLogo = Array.isArray(payload.brandLogo) ? payload.brandLogo : [];
        if (payload.role === 'brand' && brandLogo.length > 0) {
          profileImage = brandLogo[0]?.url || brandLogo[0] || null;
        }
        this.user = {
          name: payload.name || payload.fullname || payload.brandName || payload.email || 'User',
          profileImage,
          brandLogo,
          role: payload.role || payload.userType || null
        };
      } catch {
        this.user = null;
      }
    } else {
      this.user = null;
    }
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }
}
