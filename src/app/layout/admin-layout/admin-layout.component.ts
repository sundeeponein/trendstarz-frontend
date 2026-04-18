import { Component, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent {
  searchQuery = '';
  adminUser: any = null;
  dropdownOpen = false;

  constructor(private router: Router, private elRef: ElementRef) {
    this.loadAdminUser();
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.dropdownOpen && !this.elRef.nativeElement.querySelector('.profile-dropdown')?.contains(event.target)) {
      this.dropdownOpen = false;
    }
  }

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

  logout() {
    localStorage.removeItem('token');
    this.adminUser = null;
    this.router.navigate(['/']);
  }
}

