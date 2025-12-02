import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-user-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-user-table.component.html',
  styleUrls: ['./admin-user-table.component.scss']
})
export class AdminUserTableComponent implements OnInit {
  activeTab: 'influencer' | 'brand' = 'influencer';
  influencers: any[] = [];
  brands: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchUsers();
  }

  fetchUsers() {
    let token = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token') || '';
    }
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    this.http.get(`${environment.apiBaseUrl}/users/influencers`, headers)
      .pipe(timeout(5000), catchError(err => { console.error('influencers fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.influencers = res || []);
    this.http.get(`${environment.apiBaseUrl}/users/brands`, headers)
      .pipe(timeout(5000), catchError(err => { console.error('brands fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.brands = res || []);
  }

  setTab(tab: 'influencer' | 'brand') {
    this.activeTab = tab;
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
  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
}
