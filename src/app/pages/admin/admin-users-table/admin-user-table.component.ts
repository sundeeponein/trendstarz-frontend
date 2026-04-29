import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../shared/config.service';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ResolvePlatformPipe } from '../../../shared/pipes/resolve-platform.pipe';
import { AdminConfirmDialogComponent } from '../../../shared/admin-confirm-dialog/admin-confirm-dialog.component';

@Component({
  selector: 'app-admin-user-table',
  standalone: true,
  imports: [CommonModule, FormsModule, ResolvePlatformPipe, AdminConfirmDialogComponent],
  templateUrl: './admin-user-table.component.html',
  styleUrls: ['./admin-user-table.component.scss']
})
export class AdminUserTableComponent implements OnInit {
    public getPremiumDurationLabel(duration: string | undefined): string {
      switch (duration) {
        case '1m':
          return '1 Month';
        case '3m':
          return '3 Months';
        case '1y':
          return '1 Year';
        default:
          return '';
      }
    }
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
  private readonly handleUserRestoredRefresh = () => {
    this.fetchUsers();
  };

  getProfileImage(user: any): string {
    if (!user.profileImages || !user.profileImages.length) return 'assets/default-profile.png';
    const img = user.profileImages[0];
    if (img && typeof img === 'object' && img.url) return img.url;
    if (typeof img === 'string' && img) return img;
    return 'assets/default-profile.png';
  }

  getBrandLogo(user: any): string {
    if (!user.brandLogo || !user.brandLogo.length) return 'assets/default-logo.png';
    const img = user.brandLogo[0];
    if (img && typeof img === 'object' && img.url) return img.url;
    if (typeof img === 'string' && img) return img;
    return 'assets/default-logo.png';
  }

  getSignupSource(user: any): string {
    const source = user?.signupAttribution?.source;
    const audience = user?.signupAttribution?.audience;
    if (!source && !audience) return '-';
    if (source && audience) return `${source} (${audience})`;
    return source || audience || '-';
  }

  private getSignupSourceFilterValue(user: any): string {
    return user?.signupAttribution?.source || user?.signupAttribution?.audience || '';
  }
  // Helper to calculate premium end date for display if backend does not provide
  getPremiumPeriod(user: any): { start: Date, end: Date } | null {
    if (!user.isPremium) return null;
    // Prefer backend dates if present
    if (user.premiumStart && user.premiumEnd) {
      return { start: new Date(user.premiumStart), end: new Date(user.premiumEnd) };
    }
    // Fallback: calculate from acceptedAt and premiumDuration
    if (user.acceptedAt && user.premiumDuration) {
      const start = new Date(user.acceptedAt);
      let end = new Date(start);
      if (user.premiumDuration === '1m') end.setMonth(end.getMonth() + 1);
      else if (user.premiumDuration === '3m') end.setMonth(end.getMonth() + 3);
      else if (user.premiumDuration === '1y') end.setFullYear(end.getFullYear() + 1);
      return { start, end };
    }
    return null;
  }
  openPremiumModal(userId: string, userType: 'influencer' | 'brand') {
      this.premiumUserId = userId;
      this.premiumDuration = '';
      this.premiumIsPremium = true;
      this.premiumType = userType;
      this.showPremiumModal = true;
      // debug: open premium modal
    }
  activeTab: 'influencer' | 'brand' = 'influencer'; // Default to influencer tab
  influencers: any[] = [];
  brands: any[] = [];
  filteredInfluencers: any[] = [];
  filteredBrands: any[] = [];

  // Filter properties
  influencerFilters = {
    status: '',
    premium: '',
    category: '',
    state: '',
    signupSource: ''
  };
  brandFilters = {
    status: '',
    premium: '',
    category: '',
    state: '',
    signupSource: ''
  };

  // Available filter options
  categoriesArray: string[] = [];
  statesArray: string[] = [];
  statusArray: string[] = [];
  signupSourcesArray: string[] = [];

  // Premium modal state
  showPremiumModal = false;
  premiumUserId: string | null = null;
  premiumDuration: '1m' | '3m' | '1y' | '' = '';
  premiumIsPremium = true;
  premiumType: 'influencer' | 'brand' | null = null;

  // Holds an error message when profile/registration fetch fails
  registrationError: string | null = null;

  isLoading: boolean = false;

  constructor(private http: HttpClient, private configService: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.fetchUsers();
    if (typeof window !== 'undefined') {
      window.addEventListener('user-restored-refresh', this.handleUserRestoredRefresh);
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    // debug: profile token
    if (token) {
      this.configService.getInfluencerProfileById().subscribe({
        next: (profile) => {
          // debug: fetched profile
          // ...existing code...
        },
        error: (err) => {
          console.error('Profile fetch error:', err);
          this.registrationError = 'Error fetching profile.';
        }
      });
    }
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('user-restored-refresh', this.handleUserRestoredRefresh);
    }
  }


  fetchUsers() {
    this.isLoading = true;
    let token = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token') || '';
    }
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const influencerUrl = `${environment.apiBaseUrl}/admin/influencers${this.isDeletedTab() ? '?status=deleted' : ''}`;
    this.http.get<any>(influencerUrl, headers)
      .pipe(timeout(5000), catchError(err => { return of([]); }))
      .subscribe((res: any) => {
        const users = Array.isArray(res) ? res : (res?.data || []);
        // debug: fetched influencers
        this.influencers = users;
        this.applyFilters('influencer');
        this.updateAllFilterOptions();
        this.isLoading = false;
        this.cd.detectChanges();
      });
    const brandUrl = `${environment.apiBaseUrl}/admin/brands${this.isDeletedTab() ? '?status=deleted' : ''}`;
    this.http.get<any>(brandUrl, headers)
      .pipe(timeout(5000), catchError(err => { return of([]); }))
      .subscribe((res: any) => {
        const users = Array.isArray(res) ? res : (res?.data || []);
        this.brands = users;
        this.applyFilters('brand');
        this.updateAllFilterOptions();
        this.isLoading = false;
        this.cd.detectChanges();
      });
  }

  updateAllFilterOptions() {
    const categoriesSet = new Set<string>();
    const statesSet = new Set<string>();
    const statusSet = new Set<string>();
    const signupSourceSet = new Set<string>();
    
    // Collect from all influencers
    this.influencers.forEach(user => {
      if (user.categories && Array.isArray(user.categories)) {
        user.categories.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
      if (user.status) {
        statusSet.add(user.status);
      }
      const signupSource = this.getSignupSourceFilterValue(user);
      if (signupSource) {
        signupSourceSet.add(signupSource);
      }
    });
    
    // Collect from all brands
    this.brands.forEach(user => {
      if (user.categories && Array.isArray(user.categories)) {
        user.categories.forEach((cat: string) => categoriesSet.add(cat));
      }
      if (user.location?.state) {
        statesSet.add(user.location.state);
      }
      if (user.status) {
        statusSet.add(user.status);
      }
      const signupSource = this.getSignupSourceFilterValue(user);
      if (signupSource) {
        signupSourceSet.add(signupSource);
      }
    });
    
    this.categoriesArray = Array.from(categoriesSet).sort();
    this.statesArray = Array.from(statesSet).sort();
    this.statusArray = Array.from(statusSet).sort();
    this.signupSourcesArray = Array.from(signupSourceSet).sort();
  }

  applyFilters(userType: 'influencer' | 'brand') {
    const filters = userType === 'influencer' ? this.influencerFilters : this.brandFilters;
    const source = userType === 'influencer' ? this.influencers : this.brands;
    // If on User Management tab, show only non-deleted users. If on Deleted Users tab, show only deleted users.
    let filtered = source;
    if (this.isDeletedTab()) {
      filtered = filtered.filter(user => user.isDeleted === true || user.isDeleted === 'true');
    } else {
      filtered = filtered.filter(user => !user.isDeleted || user.isDeleted === false || user.isDeleted === 'false');
    }
    if (userType === 'influencer') {
      this.filteredInfluencers = filtered.filter(user => this.matchesFilters(user, filters))
      .sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      // debug: filtered influencers updated
    } else {
      this.filteredBrands = filtered.filter(user => this.matchesFilters(user, filters))
      .sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      // debug: filtered brands updated
    }
  }

  // Returns true if the Deleted Users tab is active (adjust as needed for your routing)
  isDeletedTab(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const isDeleted = window.location.pathname.includes('deleted-users');
    // debug: deleted users tab active = isDeleted
    return isDeleted;
  }

  matchesFilters(user: any, filters: any): boolean {
    // Status filter: Only filter if a specific status is selected (not empty or 'All'), otherwise show all statuses
    if (filters.status && filters.status !== '' && filters.status !== 'All' && user.status !== filters.status) {
      return false;
    }
    
    // Premium filter
    if (filters.premium === 'premium' && !user.isPremium) {
      return false;
    }
    if (filters.premium === 'free' && user.isPremium) {
      return false;
    }
    
    // Category filter
    if (filters.category && (!user.categories || !user.categories.includes(filters.category))) {
      return false;
    }
    
    // State filter
    if (filters.state && user.location?.state !== filters.state) {
      return false;
    }

    // Signup source filter
    if (
      filters.signupSource &&
      this.getSignupSourceFilterValue(user) !== filters.signupSource
    ) {
      return false;
    }
    
    return true;
  }

  onFilterChange(userType: 'influencer' | 'brand') {
    this.applyFilters(userType);
  }

  resetFilters(userType: 'influencer' | 'brand') {
    if (userType === 'influencer') {
      this.influencerFilters = { status: '', premium: '', category: '', state: '', signupSource: '' };
    } else {
      this.brandFilters = { status: '', premium: '', category: '', state: '', signupSource: '' };
    }
    this.applyFilters(userType);
  }

  setTab(tab: 'influencer' | 'brand') {
    this.activeTab = tab;
    // Reset modal state when switching tabs to avoid blank screen
    this.showPremiumModal = false;
    this.premiumUserId = null;
    this.premiumDuration = '';
    this.premiumType = null;
    // Always refetch users when switching tabs (especially for Deleted Users view)
    this.fetchUsers();
  }

  getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  acceptUser(userId: string) {
    this.showConfirm('Accept this user?', () => {
      this.http.patch(`${environment.apiBaseUrl}/users/${userId}/accept`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
    });
  }
  declineUser(userId: string) {
    this.showConfirm('Decline this user?', () => {
      this.http.patch(`${environment.apiBaseUrl}/users/${userId}/decline`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
    });
  }
  deleteUser(userId: string) {
    this.showConfirm('Delete this user? This cannot be undone.', () => {
      this.isLoading = true;
      this.http.patch(`${environment.apiBaseUrl}/users/${userId}/delete`, {}, this.getAuthHeaders()).subscribe(() => {
        this.fetchUsers();
        window.dispatchEvent(new CustomEvent('user-deleted-refresh'));
        setTimeout(() => { this.isLoading = false; }, 500);
      });
    });
  }
  restoreUser(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/restore`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
  }
  deletePermanently(userId: string) {
    this.isLoading = true;
    this.http.delete(`${environment.apiBaseUrl}/users/${userId}/permanent`, this.getAuthHeaders()).subscribe(() => {
      this.fetchUsers();
      setTimeout(() => { this.isLoading = false; }, 500);
    });
  }
  setPremium(userId: string, isPremium: boolean, userType: 'influencer' | 'brand') {
      try {
        this.premiumType = userType;
        if (isPremium) {
          this.premiumUserId = userId;
          this.premiumDuration = '';
          this.premiumIsPremium = true;
          this.showPremiumModal = true;
        } else {
          // Show confirmation before setting free
          if (confirm('Are you sure you want to set this user as Free? This will remove their premium status.')) {
            this.http.patch(`${environment.apiBaseUrl}/users/${userId}/premium`, { isPremium: false, type: userType }, this.getAuthHeaders())
              .pipe(catchError(err => {
                alert('Error setting user as Free: ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)));
                return of(null);
              }))
              .subscribe(() => this.fetchUsers());
          }
        }
      } catch (err) {
        let msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
        alert('Error in setPremium: ' + msg);
      }
  }

  confirmPremium() {
    if (!this.premiumUserId || !this.premiumDuration) {
      alert('Please select a premium duration.');
      return;
    }
    const payload = { isPremium: true, premiumDuration: this.premiumDuration, type: this.premiumType };
    this.http.patch(`${environment.apiBaseUrl}/users/${this.premiumUserId}/premium`, payload, this.getAuthHeaders())
      .pipe(catchError(err => {
        alert('Error setting user as Premium: ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)));
        return of(null);
      }))
      .subscribe((res) => {
        // Close modal after success
        this.showPremiumModal = false;
        this.premiumUserId = null;
        this.premiumDuration = '';
        this.premiumType = null;
        this.fetchUsers();
        if (res) {
          alert('User has been set as Premium successfully!');
        }
      });
  }

  closePremiumModal() {
    this.showPremiumModal = false;
    this.premiumUserId = null;
    this.premiumDuration = '';
    this.premiumType = null;
  }

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  // Handle product link click
  onProductClick(user: any, product: any, index: number) {
    // Open product image in new tab if available
    if (typeof product === 'string' && product.startsWith('http')) {
      window.open(product, '_blank');
    } else if (product && product.imageUrl) {
      window.open(product.imageUrl, '_blank');
    } else {
      alert('No image available for this product.');
    }
  }

  updateUserPrice(user: any, userType: 'influencer' | 'brand') {
    const currentPrice = user.promotionalPrice ?? user.price;
    if (user.editPrice === undefined || user.editPrice === currentPrice) return;
    const url = userType === 'influencer'
      ? `${environment.apiBaseUrl}/users/influencer-profile`
      : `${environment.apiBaseUrl}/users/brand-profile`;
    const payload = { promotionalPrice: user.editPrice, _id: user._id };
    this.http.patch(url, payload, this.getAuthHeaders())
      .pipe(catchError(err => {
        alert('Error updating price: ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)));
        return of(null);
      }))
      .subscribe((res: any) => {
        if (res && res.user) {
          user.promotionalPrice = res.user.promotionalPrice ?? res.user.price;
          user.editPrice = user.promotionalPrice;
          alert('Price updated successfully!');
        } else {
          alert('Price update failed.');
        }
      });
  }

}
