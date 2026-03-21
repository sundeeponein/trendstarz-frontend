import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../shared/config.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-deleted-users-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './deleted-users-table.component.html',
  styleUrls: ['./deleted-users-table.component.scss']
})
export class DeletedUsersTableComponent implements OnInit {
  influencers: any[] = [];
  brands: any[] = [];
  activeTab: 'influencer' | 'brand' = 'influencer';
  errorMessage: string | null = null;

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
