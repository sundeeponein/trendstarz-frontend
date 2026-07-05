import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface TrackingLink {
  code: string;
  url: string;
  clickCount: number;
  platform: string;
  contentType: string;
  destinationUrl: string;
  destinationType: string;
  moduleType: string;
}

export interface TrackingLinksAdminAnalytics {
  overview: { totalLinks: number; totalClicks: number; totalUniqueClicks: number };
  perCampaign: { campaignId: string; campaignNumber?: number; links: number; clicks: number }[];
  topPerformers: {
    code: string;
    campaignId: string;
    campaignNumber?: number;
    hostId: string;
    hostType: string;
    hostName: string;
    recipientId: string;
    recipientType: string;
    platform: string;
    contentType: string;
    clickCount: number;
    uniqueClicks: number;
    createdAt: string;
  }[];
  zeroActivity: {
    code: string;
    campaignId: string;
    campaignNumber?: number;
    recipientId: string;
    platform: string;
    contentType: string;
    createdAt: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class TrackingLinksApiService {
  constructor(private http: HttpClient) {}

  /** Get-or-create the tracked promo link for an accepted invite. Callable by the recipient or the campaign host. */
  getOrCreateTrackingLink(inviteId: string): Observable<TrackingLink> {
    return this.http
      .get<{ success: boolean; data: TrackingLink }>(`${environment.apiBaseUrl}/campaign-invites/${inviteId}/tracking-link`)
      .pipe(map((res) => res.data));
  }

  /** Public — resolves a short code to its destination and logs the click server-side. */
  resolveTrackingLink(code: string): Observable<{ destinationUrl: string | null }> {
    return this.http
      .get<{ success: boolean; data: { destinationUrl: string | null } }>(`${environment.apiBaseUrl}/tracking-links/resolve/${code}`)
      .pipe(map((res) => res.data));
  }

  getAdminAnalytics(params?: { campaignId?: string; hostId?: string; limit?: number }): Observable<TrackingLinksAdminAnalytics> {
    const query = new URLSearchParams();
    if (params?.campaignId) query.set('campaignId', params.campaignId);
    if (params?.hostId) query.set('hostId', params.hostId);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return this.http
      .get<{ success: boolean; data: TrackingLinksAdminAnalytics }>(
        `${environment.apiBaseUrl}/admin/tracking-links/analytics${qs ? '?' + qs : ''}`,
      )
      .pipe(map((res) => res.data));
  }
}
