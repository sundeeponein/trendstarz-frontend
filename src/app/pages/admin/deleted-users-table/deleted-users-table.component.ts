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
  isLoading = false;
  currentPage = 1;
  pageSize = 100;
  readonly pageSizeOptions = [25, 50, 100, 250, 500, 1000];

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
    this.fetchDeletedUsers(this.activeTab);
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
    this.fetchDeletedUsers(this.activeTab);
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

  private getDeletedAdminListUrl(userType: 'influencer' | 'brand' | 'photographer'): string {
    const endpoint =
      userType === 'influencer'
        ? 'influencers'
        : userType === 'brand'
          ? 'brands'
          : 'photographers';
    return `${environment.apiBaseUrl}/admin/${endpoint}?status=deleted&limit=1000`;
  }

  private setDeletedUsersByType(userType: 'influencer' | 'brand' | 'photographer', users: any[]): void {
    if (userType === 'influencer') {
      this.influencers = users;
    } else if (userType === 'brand') {
      this.brands = users;
    } else {
      this.photographers = users;
    }
  }

  private getDeletedUsersByType(userType: 'influencer' | 'brand' | 'photographer'): any[] {
    if (userType === 'influencer') return this.influencers;
    if (userType === 'brand') return this.brands;
    return this.photographers;
  }

  fetchDeletedUsers(userType: 'influencer' | 'brand' | 'photographer' = this.activeTab) {
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
    this.isLoading = true;
    this.http.get<any>(this.getDeletedAdminListUrl(userType), headers)
      .subscribe({
        next: (res: any) => {
          const users = Array.isArray(res) ? res : (res?.data || []);
          this.errorMessage = null;
          this.setDeletedUsersByType(userType, users);
          this.applyFilters(userType);
          this.updateAllFilterOptions(userType);
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          if (err.status === 401) {
            this.errorMessage = 'Session expired or unauthorized. Redirecting to login...';
            if (typeof window !== 'undefined') {
              setTimeout(() => { window.location.href = '/login'; }, 1500);
            }
          } else {
            this.errorMessage = `Failed to fetch deleted ${this.getRoleTitleForType(userType)}.`;
          }
        }
      });
  }

  updateAllFilterOptions(userType: 'influencer' | 'brand' | 'photographer' = this.activeTab) {
    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();

    this.getDeletedUsersByType(userType).forEach(user => {
      const categories = Array.isArray(user.categories)
        ? user.categories
        : Array.isArray(user.skills)
          ? user.skills
          : [];
      categories.forEach((cat: string) => categoriesSet.add(cat));
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
    });

    this.categoriesArray = Array.from(categoriesSet).sort();
    this.statesArray = Array.from(statesSet).sort();
  }

  private getUserSortTime(user: any): number {
    const directDate = user?.deletedAt || user?.firstRegisteredAt || user?.createdAt || user?.updatedAt;
    const parsedDate = directDate ? new Date(directDate).getTime() : 0;
    if (Number.isFinite(parsedDate) && parsedDate > 0) return parsedDate;

    const objectId = String(user?._id || '');
    if (/^[a-fA-F0-9]{24}$/.test(objectId)) {
      return parseInt(objectId.slice(0, 8), 16) * 1000;
    }
    return 0;
  }

  private sortNewestUsers(users: any[]): any[] {
    return [...users].sort((a, b) => this.getUserSortTime(b) - this.getUserSortTime(a));
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
    
    this.filteredInfluencers = userType === 'influencer' ? this.sortNewestUsers(source.filter(user => this.matchesFilters(user, filters))) : this.filteredInfluencers;
    this.filteredBrands = userType === 'brand' ? this.sortNewestUsers(source.filter(user => this.matchesFilters(user, filters))) : this.filteredBrands;
    this.filteredPhotographers = userType === 'photographer' ? this.sortNewestUsers(source.filter(user => this.matchesFilters(user, filters))) : this.filteredPhotographers;
  }

  private getFiltersForType(userType: 'influencer' | 'brand' | 'photographer') {
    if (userType === 'influencer') return this.influencerFilters;
    if (userType === 'brand') return this.brandFilters;
    return this.photographerFilters;
  }

  getActiveFilterValue(field: 'category' | 'state'): string {
    return this.getFiltersForType(this.activeTab)[field] || '';
  }

  setActiveFilterValue(field: 'category' | 'state', value: string): void {
    this.getFiltersForType(this.activeTab)[field] = value;
    this.onFilterChange(this.activeTab);
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
    this.currentPage = 1;
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
    this.currentPage = 1;
  }

  setTab(tab: 'influencer' | 'brand' | 'photographer') {
    this.activeTab = tab;
    this.currentPage = 1;
    this.fetchDeletedUsers(tab);
  }

  private getRoleTitleForType(userType: 'influencer' | 'brand' | 'photographer'): string {
    if (userType === 'influencer') return 'influencers';
    if (userType === 'brand') return 'brands';
    return 'photo/videographers';
  }

  getVisibleDeletedUsers(): any[] {
    if (this.activeTab === 'influencer') return this.filteredInfluencers || [];
    if (this.activeTab === 'brand') return this.filteredBrands || [];
    return this.filteredPhotographers || [];
  }

  getPagedDeletedUsers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.getVisibleDeletedUsers().slice(start, start + this.pageSize);
  }

  getTotalVisibleUsers(): number {
    return this.getVisibleDeletedUsers().length;
  }

  getVisibleRangeStart(): number {
    return this.getTotalVisibleUsers() ? (this.currentPage - 1) * this.pageSize + 1 : 0;
  }

  getVisibleRangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.getTotalVisibleUsers());
  }

  getRoleTitle(): string {
    if (this.activeTab === 'influencer') return 'influencers';
    if (this.activeTab === 'brand') return 'brands';
    return 'photo/videographers';
  }

  onPageSizeChange(value: string | number): void {
    this.pageSize = Number(value) || 100;
    this.currentPage = 1;
  }

  hasPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  hasNextPage(): boolean {
    return this.currentPage * this.pageSize < this.getTotalVisibleUsers();
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage()) return;
    this.currentPage -= 1;
  }

  goToNextPage(): void {
    if (!this.hasNextPage()) return;
    this.currentPage += 1;
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
