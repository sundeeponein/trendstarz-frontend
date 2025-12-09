import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
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
          // console.log('Influencer API response:', data);
          // data.forEach(u => console.log('Influencer:', u.name || u.email, 'status:', u.status, 'isPremium:', u.isPremium));
          this.influencerCount = Array.isArray(data) ? data.length : 0;
          this.influencerActivated = Array.isArray(data) ? data.filter(u => (u.status || '').toLowerCase() === 'accepted').length : 0;
          this.influencerPending = Array.isArray(data) ? data.filter(u => (u.status || '').toLowerCase() === 'pending').length : 0;
          this.influencerPremium = Array.isArray(data) ? data.filter(u => !!u.isPremium).length : 0;
        },
        error: (err) => {
          // console.error('Influencer API error:', err);
          alert('Error fetching influencers: ' + (err?.message || err));
        }
      });
  }

  fetchBrands() {
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands`, this.getAuthHeaders())
      .subscribe({
        next: (data) => {
          // console.log('Brand API response:', data);
          // data.forEach(u => console.log('Brand:', u.brandName || u.email, 'status:', u.status, 'isPremium:', u.isPremium));
          this.brandCount = Array.isArray(data) ? data.length : 0;
          this.brandActivated = Array.isArray(data) ? data.filter(u => (u.status || '').toLowerCase() === 'accepted').length : 0;
          this.brandPending = Array.isArray(data) ? data.filter(u => (u.status || '').toLowerCase() === 'pending').length : 0;
          this.brandPremium = Array.isArray(data) ? data.filter(u => !!u.isPremium).length : 0;
        },
        error: (err) => {
          // console.error('Brand API error:', err);
          alert('Error fetching brands: ' + (err?.message || err));
        }
      });
  }
}
