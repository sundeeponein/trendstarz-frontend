import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = environment.apiBaseUrl || '/api';

  constructor(private http: HttpClient) {}

  getInfluencerDashboard(): Observable<any> {
    return this.http.get(`${this.api}/dashboard/influencer`);
  }

  getBrandDashboard(): Observable<any> {
    return this.http.get(`${this.api}/dashboard/brand`);
  }

  searchInfluencers(filters: { category?: string; state?: string }): Observable<any[]> {
    const params: any = {};
    if (filters.category) params.category = filters.category;
    if (filters.state) params.state = filters.state;
    return this.http.get<any[]>(`${this.api}/users/influencers/search`, { params });
  }

  respondToInvite(inviteId: string, status: 'accepted' | 'declined'): Observable<any> {
    return this.http.patch(`${this.api}/campaign-invites/${inviteId}/respond`, { status });
  }

  getMyInvites(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/campaign-invites/influencer`);
  }
}
