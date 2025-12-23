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
    if (this.user && this.user.profileImage && typeof this.user.profileImage === 'string') {
      // Basic check: must start with http or https
      if (/^https?:\/\//.test(this.user.profileImage)) {
        return this.user.profileImage;
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
        // For brands, use brandLogo if available
        let profileImage = payload.profileImage || null;
        if (payload.role === 'brand' && payload.brandLogo && Array.isArray(payload.brandLogo) && payload.brandLogo.length > 0) {
          profileImage = payload.brandLogo[0].url || payload.brandLogo[0];
        }
        this.user = {
          name: payload.name || payload.fullname || payload.brandName || payload.email || 'User',
          profileImage,
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
