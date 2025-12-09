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
        this.user = {
          name: payload.name || 'User',
          profileImage: payload.profileImage || null
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
