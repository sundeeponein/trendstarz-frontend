import { Component, HostListener, ElementRef, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationStart, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  searchQuery = '';
  adminUser: any = null;
  dropdownOpen = false;
  mobileMenuOpen = false;
  mobileProfileMenuOpen = false;
  openDisputesCount = 0;
  private visibilityHandler = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.refreshDisputeCount();
    }
  };
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

  constructor(
    private router: Router,
    private elRef: ElementRef,
    private config: ConfigService,
    private cd: ChangeDetectorRef,
  ) {
    this.loadAdminUser();
  }

  ngOnInit() {
    this.closeMobileMenu();
    this.refreshDisputeCount();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
    this.subs.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationStart))
        .subscribe(() => this.closeMobileMenu()),
    );
  }

  ngOnDestroy() {
    this.setMobileMenuState(false);
    this.subs.unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private refreshDisputeCount() {
    this.config.adminCountOpenDisputes().subscribe({
      next: (res) => {
        const data = (res as any)?.data || res;
        this.openDisputesCount = data?.count || 0;
        this.cd.detectChanges();
      },
      error: () => {
        // silent — badge just stays at last known value
      },
    });
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (this.dropdownOpen && !this.elRef.nativeElement.querySelector('.profile-dropdown')?.contains(event.target)) {
      this.dropdownOpen = false;
    }
  }

  loadAdminUser() {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
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
}

