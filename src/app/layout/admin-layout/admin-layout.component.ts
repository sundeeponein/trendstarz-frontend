import { Component, HostListener, ElementRef, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationStart, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { filter, Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';

interface AdminNavItem {
  label: string;
  link: string;
  icon: string;
}

interface AdminNavGroup {
  key: string;
  label: string;
  icon: string;
  items: AdminNavItem[];
}

/** Grouped admin menu (desktop dropdowns + mobile sections). */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: 'users',
    label: 'Users',
    icon: 'bi-people',
    items: [
      { label: 'Users list', link: '/admin/admin-user-table', icon: 'bi-person-lines-fill' },
      { label: 'Deleted users', link: '/admin/deleted-users', icon: 'bi-trash3' },
      { label: 'Matching Evidence', link: '/admin/matching-evidence', icon: 'bi-clipboard-data' },
      { label: 'Tier Review', link: '/admin/tier-review', icon: 'bi-patch-check' },
    ],
  },
  {
    key: 'review',
    label: 'Review',
    icon: 'bi-kanban',
    items: [
      { label: 'Campaigns', link: '/admin/campaign-review', icon: 'bi-kanban' },
      { label: 'Collaborations', link: '/admin/collaboration-review', icon: 'bi-camera-reels' },
    ],
  },
];

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
  readonly navGroups = ADMIN_NAV_GROUPS;
  /** Key of the open desktop dropdown group, if any. */
  openNavGroup: string | null = null;
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
    private session: SessionService,
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
        .subscribe(() => {
          this.closeMobileMenu();
          this.closeNavGroup();
        }),
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
    if (this.openNavGroup && !(event.target as HTMLElement | null)?.closest?.('.nav-dropdown')) {
      this.openNavGroup = null;
    }
  }

  loadAdminUser() {
    const token = this.session.getToken();
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
    this.session.clearSession();
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

  toggleNavGroup(key: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.openNavGroup = this.openNavGroup === key ? null : key;
  }

  closeNavGroup() {
    this.openNavGroup = null;
  }

  /** A group is highlighted while any of its pages is open. */
  isNavGroupActive(group: AdminNavGroup): boolean {
    const current = (this.router.url || '').split('?')[0];
    return group.items.some((item) => current === item.link || current.startsWith(item.link + '/'));
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
