import { Component, OnInit } from '@angular/core';
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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchInfluencers();
    this.fetchBrands();
  }

  fetchInfluencers() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/influencers`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : [];
          const filtered = all.filter(u => (u.status || '').toLowerCase() !== 'deleted');
          this.influencerCount = filtered.length;
          this.influencerActivated = filtered.filter(u => (u.status || '').toLowerCase() === 'accepted').length;
          this.influencerPending = filtered.filter(u => (u.status || '').toLowerCase() === 'pending').length;
          this.influencerPremium = filtered.filter(u => !!u.isPremium).length;
          this.influencerDeleted = all.filter(u => (u.status || '').toLowerCase() === 'deleted').length;
        },
        error: (err) => {
          alert('Error fetching influencers: ' + (err?.message || err));
        }
      });
  }

  fetchBrands() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          const all = Array.isArray(data) ? data : [];
          const filtered = all.filter(u => (u.status || '').toLowerCase() !== 'deleted');
          this.brandCount = filtered.length;
          this.brandActivated = filtered.filter(u => (u.status || '').toLowerCase() === 'accepted').length;
          this.brandPending = filtered.filter(u => (u.status || '').toLowerCase() === 'pending').length;
          this.brandPremium = filtered.filter(u => !!u.isPremium).length;
          this.brandDeleted = all.filter(u => (u.status || '').toLowerCase() === 'deleted').length;
        },
        error: (err) => {
          alert('Error fetching brands: ' + (err?.message || err));
        }
      });
  }
}
