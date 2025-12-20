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
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/influencers?status=deleted`, headers)
      .subscribe((res: any) => {
        this.influencers = (res || []).filter((u: any) => u.status === 'deleted');
      });
    this.http.get<any[]>(`${environment.apiBaseUrl}/admin/brands?status=deleted`, headers)
      .subscribe((res: any) => {
        this.brands = (res || []).filter((u: any) => u.status === 'deleted');
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
    this.http.patch(`${environment.apiBaseUrl}/users/${userId}/delete-permanent`, {}, this.getAuthHeaders())
      .subscribe(() => this.fetchDeletedUsers());
  }

  getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }
}
