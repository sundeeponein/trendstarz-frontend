import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserCardComponent } from '../../shared/user-card/user-card.component';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-user-table',
  standalone: true,
  imports: [CommonModule, UserCardComponent],
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
    this.http.get(`${environment.apiBaseUrl}/users/influencers`)
      .pipe(timeout(5000), catchError(err => { console.error('influencers fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.influencers = res || []);
    this.http.get(`${environment.apiBaseUrl}/users/brands`)
      .pipe(timeout(5000), catchError(err => { console.error('brands fetch failed', err); return of([]); }))
      .subscribe((res: any) => this.brands = res || []);
  }

  setTab(tab: 'influencer' | 'brand') {
    this.activeTab = tab;
  }

  acceptUser(userId: string) {
    this.http.post(`${environment.apiBaseUrl}/users/${userId}/accept`, {}).subscribe(() => this.fetchUsers());
  }
  declineUser(userId: string) {
    this.http.post(`${environment.apiBaseUrl}/users/${userId}/decline`, {}).subscribe(() => this.fetchUsers());
  }
  deleteUser(userId: string) {
    this.http.post(`${environment.apiBaseUrl}/users/${userId}/delete`, {}).subscribe(() => this.fetchUsers());
  }
  restoreUser(userId: string) {
    this.http.post(`${environment.apiBaseUrl}/users/${userId}/restore`, {}).subscribe(() => this.fetchUsers());
  }
  deletePermanently(userId: string) {
    this.http.post(`${environment.apiBaseUrl}/users/${userId}/delete-permanent`, {}).subscribe(() => this.fetchUsers());
  }
}
