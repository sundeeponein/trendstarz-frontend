import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  influencerDeleted = 0;
  brandDeleted = 0;
  getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }
  influencerCount = 0;
  influencerActivated = 0;
  influencerPending = 0;
  influencerPremium = 0;

  brandCount = 0;
  brandActivated = 0;
  brandPending = 0;
  brandPremium = 0;

  private notifyClient(message: string) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    }
  }

  constructor(private http: HttpClient, private cd: ChangeDetectorRef, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchInfluencers();
      this.fetchBrands();
    }
  }

  fetchInfluencers() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/influencers`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          // console.log('[AdminDashboard] Influencer API response:', data);
          // if (Array.isArray(data) && data.length > 0) {
          //   console.log('[AdminDashboard] First influencer object keys:', Object.keys(data[0]));
          //   console.log('[AdminDashboard] First influencer object:', data[0]);
          //   console.log('[AdminDashboard] All influencer status values:', data.map(u => u.status));
          // }
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          const filtered = all.filter((u: any) => (u.status || '').toLowerCase() !== 'deleted');
          this.influencerCount = filtered.length;
          this.influencerActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.influencerPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.influencerPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.influencerDeleted = all.filter((u: any) => (u.status || '').toLowerCase() === 'deleted').length;
          this.cd.detectChanges();
        },
        error: (err) => {
          console.error('[AdminDashboard] Error fetching influencers:', err);
          this.notifyClient('Error fetching influencers: ' + (err?.message || err));
        }
      });
  }

  fetchBrands() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          // console.log('[AdminDashboard] Brand API response:', data);
          // if (Array.isArray(data) && data.length > 0) {
          //   console.log('[AdminDashboard] First brand object keys:', Object.keys(data[0]));
          //   console.log('[AdminDashboard] First brand object:', data[0]);
          //   console.log('[AdminDashboard] All brand status values:', data.map(u => u.status));
          // }
          const all = Array.isArray(data) ? data : ((data as any)?.data || []);
          const filtered = all.filter((u: any) => (u.status || '').toLowerCase() !== 'deleted');
          this.brandCount = filtered.length;
          this.brandActivated = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'accepted').length;
          this.brandPending = filtered.filter((u: any) => (u.status || '').toLowerCase() === 'pending').length;
          this.brandPremium = filtered.filter((u: any) => !!u.isPremium).length;
          this.brandDeleted = all.filter((u: any) => (u.status || '').toLowerCase() === 'deleted').length;
          this.cd.detectChanges();
        },
        error: (err) => {
          console.error('[AdminDashboard] Error fetching brands:', err);
          this.notifyClient('Error fetching brands: ' + (err?.message || err));
        }
      });
  }
}
