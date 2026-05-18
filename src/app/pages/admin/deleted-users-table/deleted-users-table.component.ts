import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ConfigService } from '../../../shared/config.service';
import { environment } from '../../../../environments/environment';
import { AdminConfirmDialogComponent } from '../../../shared/admin-confirm-dialog/admin-confirm-dialog.component';

@Component({
  selector: 'app-deleted-users-table',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminConfirmDialogComponent],
  templateUrl: './deleted-users-table.component.html',
  styleUrls: ['./deleted-users-table.component.scss']
})
export class DeletedUsersTableComponent implements OnInit {
  // Confirmation dialog state
  confirmDialogOpen = false;
  confirmDialogMessage = '';
  confirmDialogAction: (() => void) | null = null;

  showConfirm(message: string, action: () => void) {
    this.confirmDialogMessage = message;
    this.confirmDialogAction = action;
    this.confirmDialogOpen = true;
  }

  onConfirmDialogConfirm() {
    if (this.confirmDialogAction) this.confirmDialogAction();
    this.confirmDialogOpen = false;
    this.confirmDialogAction = null;
  }

  onConfirmDialogCancel() {
    this.confirmDialogOpen = false;
    this.confirmDialogAction = null;
  }
  influencers: any[] = [];
  brands: any[] = [];
  photographers: any[] = [];
  filteredInfluencers: any[] = [];
  filteredBrands: any[] = [];
  filteredPhotographers: any[] = [];
  activeTab: 'influencer' | 'brand' | 'photographer' = 'influencer';
  errorMessage: string | null = null;

  // Filter properties
  influencerFilters = {
    category: '',
    state: ''
  };
  brandFilters = {
    category: '',
    state: ''
  };
  photographerFilters = {
    category: '',
    state: ''
  };

  // Available filter options
  categoriesArray: string[] = [];
  statesArray: string[] = [];

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.fetchDeletedUsers();
    // Listen for user-deleted-refresh event to auto-refresh deleted users (only in browser)
    if (typeof window !== 'undefined') {
      window.addEventListener('user-deleted-refresh', this.handleUserDeletedRefresh);
    }
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('user-deleted-refresh', this.handleUserDeletedRefresh);
    }
  }

  handleUserDeletedRefresh = () => {
    this.fetchDeletedUsers();
  }

  private dispatchAdminRefresh(eventName: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(eventName));
    }
  }

  private removeUserFromDeletedLists(userId: string) {
    this.influencers = this.influencers.filter(user => user._id !== userId);
    this.brands = this.brands.filter(user => user._id !== userId);
    this.photographers = this.photographers.filter(user => user._id !== userId);
    this.applyFilters('influencer');
    this.applyFilters('brand');
    this.applyFilters('photographer');
    this.updateAllFilterOptions();
  }

  fetchDeletedUsers() {
    let token = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    }
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    if (!token) {
      this.errorMessage = 'You are not authorized. Please log in again.';
      if (typeof window !== 'undefined') {
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      }
      return;
    }
    this.http.get<any>(`${environment.apiBaseUrl}/admin/influencers?status=deleted`, headers)
      .subscribe({
        next: (res: any) => {
          const users = Array.isArray(res) ? res : (res?.data || []);
          // debug: deleted influencers received
          this.influencers = users;
          this.applyFilters('influencer');
          this.updateAllFilterOptions();
        },
        error: (err) => {
          if (err.status === 401) {
            this.errorMessage = 'Session expired or unauthorized. Redirecting to login...';
            if (typeof window !== 'undefined') {
              setTimeout(() => { window.location.href = '/login'; }, 1500);
            }
          } else {
            this.errorMessage = 'Failed to fetch deleted influencers.';
          }
        }
      });
    this.http.get<any>(`${environment.apiBaseUrl}/admin/brands?status=deleted`, headers)
      .subscribe({
        next: (res: any) => {
          const users = Array.isArray(res) ? res : (res?.data || []);
          this.brands = users;
          this.applyFilters('brand');
          this.updateAllFilterOptions();
        },
        error: (err) => {
          if (err.status === 401) {
            this.errorMessage = 'Session expired or unauthorized. Redirecting to login...';
            if (typeof window !== 'undefined') {
              setTimeout(() => { window.location.href = '/login'; }, 1500);
            }
          } else {
            this.errorMessage = 'Failed to fetch deleted brands.';
          }
        }
      });
    this.http.get<any>(`${environment.apiBaseUrl}/admin/photographers?status=deleted`, headers)
      .subscribe({
        next: (res: any) => {
          const users = Array.isArray(res) ? res : (res?.data || []);
          this.photographers = users;
          this.applyFilters('photographer');
          this.updateAllFilterOptions();
        },
        error: (err) => {
          if (err.status === 401) {
            this.errorMessage = 'Session expired or unauthorized. Redirecting to login...';
            if (typeof window !== 'undefined') {
              setTimeout(() => { window.location.href = '/login'; }, 1500);
            }
          } else {
            this.errorMessage = 'Failed to fetch deleted photographers.';
          }
        }
      });
  }

  updateAllFilterOptions() {
    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();
    
    // Collect from all deleted influencers
    this.influencers.forEach(user => {
      if (user.categories && Array.isArray(user.categories)) {
        user.categories.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
    });
    
    // Collect from all deleted brands
    this.brands.forEach(user => {
      if (user.categories && Array.isArray(user.categories)) {
        user.categories.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
    });

    this.photographers.forEach(user => {
      if (user.skills && Array.isArray(user.skills)) {
        user.skills.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
    });
    
    this.categoriesArray = Array.from(categoriesSet).sort();
    this.statesArray = Array.from(statesSet).sort();
  }

  applyFilters(userType: 'influencer' | 'brand' | 'photographer') {
    const filters = userType === 'influencer'
      ? this.influencerFilters
      : userType === 'brand'
        ? this.brandFilters
        : this.photographerFilters;
    const source = userType === 'influencer'
      ? this.influencers
      : userType === 'brand'
        ? this.brands
        : this.photographers;
    
    this.filteredInfluencers = userType === 'influencer' ? source.filter(user => this.matchesFilters(user, filters)) : this.filteredInfluencers;
    this.filteredBrands = userType === 'brand' ? source.filter(user => this.matchesFilters(user, filters)) : this.filteredBrands;
    this.filteredPhotographers = userType === 'photographer' ? source.filter(user => this.matchesFilters(user, filters)) : this.filteredPhotographers;
  }

  matchesFilters(user: any, filters: any): boolean {
    // Category filter
    const categories = Array.isArray(user.categories)
      ? user.categories
      : Array.isArray(user.skills)
        ? user.skills
        : [];
    if (filters.category && !categories.includes(filters.category)) {
      return false;
    }
    
    // State filter
    if (filters.state && user.location?.state !== filters.state) {
      return false;
    }
    
    return true;
  }

  onFilterChange(userType: 'influencer' | 'brand' | 'photographer') {
    this.applyFilters(userType);
  }

  resetFilters(userType: 'influencer' | 'brand' | 'photographer') {
    if (userType === 'influencer') {
      this.influencerFilters = { category: '', state: '' };
    } else if (userType === 'brand') {
      this.brandFilters = { category: '', state: '' };
    } else {
      this.photographerFilters = { category: '', state: '' };
    }
    this.applyFilters(userType);
  }

  setTab(tab: 'influencer' | 'brand' | 'photographer') {
    this.activeTab = tab;
    this.applyFilters(tab);
  }

  restoreUser(userId: string) {
    this.showConfirm('Restore this user?', () => {
      this.http.patch(`${environment.apiBaseUrl}/users/${userId}/restore`, {}, this.getAuthHeaders())
        .subscribe({
          next: () => {
            this.errorMessage = null;
            this.removeUserFromDeletedLists(userId);
            this.dispatchAdminRefresh('user-restored-refresh');
            this.router.navigate(['/admin/admin-user-table']);
          },
          error: (err) => {
            this.errorMessage = err?.error?.message || 'Failed to restore user.';
          }
        });
    });
  }

  deletePermanently(userId: string) {
    this.showConfirm(
      'Permanently delete this user? This action cannot be undone. All profile data and uploaded images will be removed.',
      () => {
        this.http.delete(`${environment.apiBaseUrl}/users/${userId}/permanent`, this.getAuthHeaders())
          .subscribe({
            next: () => {
              this.errorMessage = null;
              this.removeUserFromDeletedLists(userId);
              this.dispatchAdminRefresh('user-deleted-refresh');
            },
            error: (err) => {
              this.errorMessage = err?.error?.message || 'Failed to permanently delete user.';
            }
          });
      }
    );
  }

  getAuthHeaders() {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  onProductClick(product: any) {
    if (product && product.imageUrl) {
      window.open(product.imageUrl, '_blank');
    }
  }
}
