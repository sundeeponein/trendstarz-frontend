import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../shared/config.service';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-user-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-user-table.component.html',
  styleUrls: ['./admin-user-table.component.scss']
})
export class AdminUserTableComponent implements OnInit {
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
      console.log('[ADMIN] Set Premium clicked for user:', userId, 'userType:', userType);
      this.premiumUserId = userId;
      this.premiumDuration = '';
      this.premiumIsPremium = true;
      this.premiumType = userType;
      this.showPremiumModal = true;
      console.log('[ADMIN] showPremiumModal:', this.showPremiumModal);
    }
  activeTab: 'influencer' | 'brand' = 'influencer'; // Default to influencer tab
  influencers: any[] = [];
  brands: any[] = [];

  // Premium modal state
  showPremiumModal = false;
  premiumUserId: string | null = null;
  premiumDuration: '1m' | '3m' | '1y' | '' = '';
  premiumIsPremium = true;
  premiumType: 'influencer' | 'brand' | null = null;

  constructor(private http: HttpClient, private configService: ConfigService) {}

  ngOnInit() {
    this.fetchUsers();
  }

  fetchUsers() {
    let token = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token') || '';
    }
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/influencers`, headers)
      .pipe(timeout(5000), catchError(err => { return of([]); }))
      .subscribe((res: any) => {
        this.influencers = (res || []).filter((u: any) => u.status !== 'deleted');
      });
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands`, headers)
      .pipe(timeout(5000), catchError(err => { return of([]); }))
      .subscribe((res: any) => {
        this.brands = (res || []).filter((u: any) => u.status !== 'deleted');
      });
  }

  setTab(tab: 'influencer' | 'brand') {
  this.activeTab = tab;
  // Reset modal state when switching tabs to avoid blank screen
  this.showPremiumModal = false;
  this.premiumUserId = null;
  this.premiumDuration = '';
  this.premiumType = null;
  }

  getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  acceptUser(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/accept`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
  }
  declineUser(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/decline`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
  }
  deleteUser(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/delete`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
  }
  restoreUser(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/restore`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
  }
  deletePermanently(userId: string) {
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/delete-permanent`, {}, this.getAuthHeaders()).subscribe(() => this.fetchUsers());
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
}
