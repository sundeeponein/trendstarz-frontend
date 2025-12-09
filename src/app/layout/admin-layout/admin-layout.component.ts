import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html'
})
export class AdminLayoutComponent {
  constructor(private router: Router) {
    this.loadAdminUser();
  }
  logout() {
    localStorage.removeItem('token');
    this.adminUser = null;
    this.router.navigate(['/']);
  }
  adminUser: any = null;


  loadAdminUser() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.adminUser = {
          name: payload.name || 'Admin',
          profileImage: payload.profileImage || null
        };
      } catch {
        this.adminUser = null;
      }
    } else {
      this.adminUser = null;
    }
  }
}
