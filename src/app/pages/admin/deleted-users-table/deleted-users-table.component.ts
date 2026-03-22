import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../shared/config.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-deleted-users-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deleted-users-table.component.html',
  styleUrls: ['./deleted-users-table.component.scss']
})
export class DeletedUsersTableComponent implements OnInit {
  influencers: any[] = [];
  brands: any[] = [];
  filteredInfluencers: any[] = [];
  filteredBrands: any[] = [];
  activeTab: 'influencer' | 'brand' = 'influencer';
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

  // Available filter options
  categoriesArray: string[] = [];
  statesArray: string[] = [];

  constructor(private http: HttpClient, private configService: ConfigService) {}

  ngOnInit() {
    this.fetchDeletedUsers();
  }

  fetchDeletedUsers() {
    let token = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token') || '';
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
          const users = res?.data || [];
          console.log('[DeletedUsers] Influencers received:', users);
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
          const users = res?.data || [];
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
    
    this.categoriesArray = Array.from(categoriesSet).sort();
    this.statesArray = Array.from(statesSet).sort();
  }

  applyFilters(userType: 'influencer' | 'brand') {
    const filters = userType === 'influencer' ? this.influencerFilters : this.brandFilters;
    const source = userType === 'influencer' ? this.influencers : this.brands;
    
    this.filteredInfluencers = userType === 'influencer' ? source.filter(user => this.matchesFilters(user, filters)) : this.filteredInfluencers;
    this.filteredBrands = userType === 'brand' ? source.filter(user => this.matchesFilters(user, filters)) : this.filteredBrands;
  }

  matchesFilters(user: any, filters: any): boolean {
    // Category filter
    if (filters.category && (!user.categories || !user.categories.includes(filters.category))) {
      return false;
    }
    
    // State filter
    if (filters.state && user.location?.state !== filters.state) {
      return false;
    }
    
    return true;
  }

  onFilterChange(userType: 'influencer' | 'brand') {
    this.applyFilters(userType);
  }

  resetFilters(userType: 'influencer' | 'brand') {
    if (userType === 'influencer') {
      this.influencerFilters = { category: '', state: '' };
    } else {
      this.brandFilters = { category: '', state: '' };
    }
    this.applyFilters(userType);
  }

  setTab(tab: 'influencer' | 'brand') {
    this.activeTab = tab;
  }

  restoreUser(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/restore`, {}, this.getAuthHeaders())
      .subscribe(() => this.fetchDeletedUsers());
  }

  deletePermanently(userId: string) {
    this.http.delete(`${environment.apiBaseUrl}/users/${userId}/permanent`, this.getAuthHeaders())
      .subscribe(() => this.fetchDeletedUsers());
  }

  getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  onProductClick(product: any) {
    if (product && product.imageUrl) {
      window.open(product.imageUrl, '_blank');
    }
  }
}
