import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  selectedRoleTab: 'influencer' | 'brand' | 'photographer' = 'influencer';

  // --- Summary counts ---
  influencerCount = 0;
  influencerActivated = 0;
  influencerPending = 0;
  influencerPremium = 0;
  influencerDeleted = 0;

  brandCount = 0;
  brandActivated = 0;
  brandPending = 0;
  brandPremium = 0;
  brandDeleted = 0;

  photographerCount = 0;
  photographerActivated = 0;
  photographerPending = 0;
  photographerPremium = 0;
  photographerDeleted = 0;

  // --- Quick stats strip ---
  totalPending = 0;
  totalVerified = 0;
  premiumTotal = 0;
  suspiciousFlaggedTotal = 0;
  suspiciousFlaggedInfluencers = 0;
  suspiciousFlaggedBrands = 0;
  suspiciousFlaggedPhotographers = 0;

  // --- Verification queue ---
  pendingMobileVerif = 0;
  pendingEmailVerif = 0;
  pendingApproval = 0;
  latestPendingUsers: { type: 'influencer' | 'brand' | 'photographer'; name: string; label: string }[] = [];

  pendingMobileVerifInfluencer = 0;
  pendingMobileVerifBrand = 0;
  pendingMobileVerifPhotographer = 0;
  pendingEmailVerifInfluencer = 0;
  pendingEmailVerifBrand = 0;
  pendingEmailVerifPhotographer = 0;
  pendingApprovalInfluencer = 0;
  pendingApprovalBrand = 0;
  pendingApprovalPhotographer = 0;

  latestPendingInfluencers: { type: 'influencer' | 'brand' | 'photographer'; name: string; label: string }[] = [];
  latestPendingBrands: { type: 'influencer' | 'brand' | 'photographer'; name: string; label: string }[] = [];
  latestPendingPhotographers: { type: 'influencer' | 'brand' | 'photographer'; name: string; label: string }[] = [];

  // --- Recent registrations (left panel) ---
  recentRegistrations: { type: 'influencer' | 'brand' | 'photographer'; name: string; email: string; status: string; createdAt: string }[] = [];
  recentInfluencerRegistrations: { type: 'influencer' | 'brand' | 'photographer'; name: string; email: string; status: string; createdAt: string }[] = [];
  recentBrandRegistrations: { type: 'influencer' | 'brand' | 'photographer'; name: string; email: string; status: string; createdAt: string }[] = [];
  recentPhotographerRegistrations: { type: 'influencer' | 'brand' | 'photographer'; name: string; email: string; status: string; createdAt: string }[] = [];

  private allInfluencers: any[] = [];
  private allBrands: any[] = [];
  private allPhotographers: any[] = [];
  private fetchedCount = 0;

  getAuthHeaders() {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  constructor(private http: HttpClient, private cd: ChangeDetectorRef, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchInfluencers();
      this.fetchBrands();
      this.fetchPhotographers();
    }
  }

  private onFetchDone() {
    this.fetchedCount++;
    if (this.fetchedCount >= 3) {
      this.buildDerivedData();
    }
  }

  get visibleRecentRegistrations() {
    if (this.selectedRoleTab === 'photographer') return this.recentPhotographerRegistrations;
    return this.selectedRoleTab === 'influencer'
      ? this.recentInfluencerRegistrations
      : this.recentBrandRegistrations;
  }

  get visiblePendingUsers() {
    if (this.selectedRoleTab === 'photographer') return this.latestPendingPhotographers;
    return this.selectedRoleTab === 'influencer'
      ? this.latestPendingInfluencers
      : this.latestPendingBrands;
  }

  get visiblePendingApprovalCount() {
    if (this.selectedRoleTab === 'photographer') return this.pendingApprovalPhotographer;
    return this.selectedRoleTab === 'influencer'
      ? this.pendingApprovalInfluencer
      : this.pendingApprovalBrand;
  }

  get visiblePendingMobileCount() {
    if (this.selectedRoleTab === 'photographer') return this.pendingMobileVerifPhotographer;
    return this.selectedRoleTab === 'influencer'
      ? this.pendingMobileVerifInfluencer
      : this.pendingMobileVerifBrand;
  }

  get visiblePendingEmailCount() {
    if (this.selectedRoleTab === 'photographer') return this.pendingEmailVerifPhotographer;
    return this.selectedRoleTab === 'influencer'
      ? this.pendingEmailVerifInfluencer
      : this.pendingEmailVerifBrand;
  }

  setRoleTab(role: 'influencer' | 'brand' | 'photographer') {
    this.selectedRoleTab = role;
  }

  private buildDerivedData() {
    const combined = [
      ...this.allInfluencers.map(u => ({
        type: 'influencer' as const,
        name: u.name || u.username || 'Influencer',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
      })),
      ...this.allBrands.map(u => ({
        type: 'brand' as const,
        name: u.brandName || u.brandUsername || 'Brand',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
      })),
      ...this.allPhotographers.map(u => ({
        type: 'photographer' as const,
        name: u.name || u.username || 'Photographer',
        email: u.email || '',
        status: u.status || 'pending',
        createdAt: u.createdAt || '',
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    this.recentRegistrations = combined.slice(0, 8);
    this.recentInfluencerRegistrations = combined.filter(u => u.type === 'influencer').slice(0, 8);
    this.recentBrandRegistrations = combined.filter(u => u.type === 'brand').slice(0, 8);
    this.recentPhotographerRegistrations = combined.filter(u => u.type === 'photographer').slice(0, 8);

    // --- Quick stats ---
    this.totalPending = this.influencerPending + this.brandPending + this.photographerPending;
    this.totalVerified = this.influencerActivated + this.brandActivated + this.photographerActivated;
    this.premiumTotal = this.influencerPremium + this.brandPremium + this.photographerPremium;

    // --- Verification queue ---
    const activeInf = this.allInfluencers.filter(u => (u.status || '').toLowerCase() !== 'deleted');
    const activeBrand = this.allBrands.filter(u => (u.status || '').toLowerCase() !== 'deleted');
    const activePhotographer = this.allPhotographers.filter(u => (u.status || '').toLowerCase() !== 'deleted');

    this.suspiciousFlaggedInfluencers = activeInf.filter((u: any) => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedBrands = activeBrand.filter((u: any) => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedPhotographers = activePhotographer.filter((u: any) => this.isSuspiciousOrFlagged(u)).length;
    this.suspiciousFlaggedTotal = this.suspiciousFlaggedInfluencers + this.suspiciousFlaggedBrands + this.suspiciousFlaggedPhotographers;

    this.pendingMobileVerifInfluencer = activeInf.filter(u => !u.isMobileVerified).length;
    this.pendingMobileVerifBrand = activeBrand.filter(u => !u.isMobileVerified).length;
    this.pendingMobileVerifPhotographer = activePhotographer.filter(u => !u.isMobileVerified).length;
    this.pendingMobileVerif =
      this.pendingMobileVerifInfluencer + this.pendingMobileVerifBrand + this.pendingMobileVerifPhotographer;

    this.pendingEmailVerifInfluencer = activeInf.filter(u => !u.isEmailVerified).length;
    this.pendingEmailVerifBrand = activeBrand.filter(u => !u.isEmailVerified).length;
    this.pendingEmailVerifPhotographer = activePhotographer.filter(u => !u.isEmailVerified).length;
    this.pendingEmailVerif =
      this.pendingEmailVerifInfluencer + this.pendingEmailVerifBrand + this.pendingEmailVerifPhotographer;

    this.pendingApprovalInfluencer = this.influencerPending;
    this.pendingApprovalBrand = this.brandPending;
    this.pendingApprovalPhotographer = this.photographerPending;
    this.pendingApproval = this.totalPending;

    // Latest pending users for queue preview (top 5)
    this.latestPendingUsers = combined
      .filter(u => u.status === 'pending')
      .slice(0, 5)
      .map(u => ({
        type: u.type,
        name: u.name,
        label: u.type === 'influencer' ? 'Influencer — Pending' : u.type === 'brand' ? 'Brand — Pending' : 'Photographer — Pending',
      }));

    this.latestPendingInfluencers = this.latestPendingUsers.filter(u => u.type === 'influencer').slice(0, 5);
    this.latestPendingBrands = this.latestPendingUsers.filter(u => u.type === 'brand').slice(0, 5);
    this.latestPendingPhotographers = this.latestPendingUsers.filter(u => u.type === 'photographer').slice(0, 5);

    this.cd.detectChanges();
  }

  private isSuspiciousOrFlagged(user: any): boolean {
    if (!user) return false;
    if (user.isFlagged === true || user.flagged === true || user.isSuspicious === true) {
      return true;
    }
    const tags = Array.isArray(user.adminTags) ? user.adminTags : [];
    return tags.some((tag: any) => {
      const value = String(tag || '').toLowerCase();
      return value.includes('flagged') || value.includes('suspicious');
    });
  }

  fetchInfluencers() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/influencers`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allInfluencers = all;
          const filtered = all.filter((u: any) => (u.status || '').toLowerCase() !== 'deleted');
          this.influencerCount = filtered.length;
          this.influencerActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.influencerPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.influencerPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.influencerDeleted = all.filter((u: any) => (u.status || '').toLowerCase() === 'deleted').length;
          this.onFetchDone();
        },
        error: (err) => {
          console.error('[AdminDashboard] Error fetching influencers:', err);
          this.onFetchDone();
        }
      });
  }

  fetchBrands() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allBrands = all;
          const filtered = all.filter((u: any) => (u.status || '').toLowerCase() !== 'deleted');
          this.brandCount = filtered.length;
          this.brandActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.brandPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.brandPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.brandDeleted = all.filter((u: any) => (u.status || '').toLowerCase() === 'deleted').length;
          this.onFetchDone();
        },
        error: (err) => {
          console.error('[AdminDashboard] Error fetching brands:', err);
          this.onFetchDone();
        }
      });
  }

  fetchPhotographers() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/photographers`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          this.allPhotographers = all;
          const filtered = all.filter((u: any) => (u.status || '').toLowerCase() !== 'deleted');
          this.photographerCount = filtered.length;
          this.photographerActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.photographerPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.photographerPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.photographerDeleted = all.filter((u: any) => (u.status || '').toLowerCase() === 'deleted').length;
          this.onFetchDone();
        },
        error: (err) => {
          console.error('[AdminDashboard] Error fetching photographers:', err);
          this.onFetchDone();
        }
      });
  }
}
