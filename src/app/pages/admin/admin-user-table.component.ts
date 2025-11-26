import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserCardComponent } from '../../shared/user-card/user-card.component';
import { HttpClient } from '@angular/common/http';

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
    this.http.get('/api/users/influencers').subscribe((res: any) => this.influencers = res);
    this.http.get('/api/users/brands').subscribe((res: any) => this.brands = res);
  }

  setTab(tab: 'influencer' | 'brand') {
    this.activeTab = tab;
  }

  acceptUser(userId: string) {
    this.http.post(`/api/users/${userId}/accept`, {}).subscribe(() => this.fetchUsers());
  }
  declineUser(userId: string) {
    this.http.post(`/api/users/${userId}/decline`, {}).subscribe(() => this.fetchUsers());
  }
  deleteUser(userId: string) {
    this.http.post(`/api/users/${userId}/delete`, {}).subscribe(() => this.fetchUsers());
  }
  restoreUser(userId: string) {
    this.http.post(`/api/users/${userId}/restore`, {}).subscribe(() => this.fetchUsers());
  }
  deletePermanently(userId: string) {
    this.http.post(`/api/users/${userId}/delete-permanent`, {}).subscribe(() => this.fetchUsers());
  }
}
