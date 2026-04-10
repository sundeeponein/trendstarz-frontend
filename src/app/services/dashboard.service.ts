import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  getInfluencerDashboard(): Observable<any> {
    return this.http.get('/api/dashboard/influencer');
  }

  getBrandDashboard(): Observable<any> {
    return this.http.get('/api/dashboard/brand');
  }

  searchInfluencers(filters: { category?: string; state?: string }): Observable<any[]> {
    const params: any = {};
    if (filters.category) params.category = filters.category;
    if (filters.state) params.state = filters.state;
    return this.http.get<any[]>('/api/users/influencers/search', { params });
  }

  respondToInvite(inviteId: string, status: 'accepted' | 'declined'): Observable<any> {
    return this.http.patch(`/api/campaign-invites/${inviteId}/respond`, { status });
  }

  getMyInvites(): Observable<any[]> {
    return this.http.get<any[]>('/api/campaign-invites/influencer');
  }
}
