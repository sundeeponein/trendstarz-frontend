import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProfileFlag {
  _id?: string;
  id?: string;
  userId?: string;
  userType?: string;
  category: string;
  flagCode: string;
  severity: 'Low' | 'Medium' | 'High';
  message: string;
  status: 'Open' | 'Resolved' | 'Ignored';
  createdBy?: 'AUTO' | 'ADMIN';
  createdAt?: string;
  reviewedAt?: string;
}

export interface VerificationChecklistItem {
  label: string;
  status: 'Verified' | 'Pending' | 'Failed' | 'Action Required' | 'Not Added';
}

export interface ProfileVerificationDashboard {
  userId: string;
  userType: string;
  displayName: string;
  profileCompletion: number;
  profileQualityScore: number;
  profileQualityLabel: string;
  /** Profile data-quality tier (Draft/Under Review/Needs Attention/Good Profile/Brand Ready/Outstanding Profile) — NOT admin approval. */
  profileTier: string;
  /** Real admin-approval status display label (Pending/Under Review/Approved/Rejected/Removed). Independent of profileTier above. */
  verificationStatus: string;
  /** The real admin-approval gate — same one campaign eligibility uses. Independent of profileTier above. */
  isTrendstarzVerified: boolean;
  verificationChecks?: Record<string, any>;
  verificationBadges?: Array<{ label: string; verified: boolean }>;
  checklist: VerificationChecklistItem[];
  actionRequired: ProfileFlag[];
  flags: ProfileFlag[];
  campaignEligibility: { eligible: boolean; blockers: string[] };
  campaignStatus: 'eligible' | 'profile_update_required' | 'restricted';
}

export interface ModerationRow {
  userId: string;
  userType: 'Influencer' | 'Brand' | 'Photographer';
  name: string;
  email: string;
  profileCompletion: number;
  profileQualityScore: number;
  profileTier: string;
  verificationStatus: string;
  openFlagsCount: number;
  adminReviewPending: boolean;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileVerificationService {
  private apiUrl = environment.apiBaseUrl || '/api';

  constructor(private http: HttpClient) {}

  private unwrap<T>(res: any): T {
    return (res?.data ?? res) as T;
  }

  getMyDashboard(): Observable<ProfileVerificationDashboard> {
    return this.http
      .get<any>(`${this.apiUrl}/profile-verification/me`)
      .pipe(map((res) => this.unwrap<ProfileVerificationDashboard>(res)));
  }

  resubmit(): Observable<ProfileVerificationDashboard> {
    return this.http
      .post<any>(`${this.apiUrl}/profile-verification/resubmit`, {})
      .pipe(map((res) => this.unwrap<ProfileVerificationDashboard>(res)));
  }

  getEligibility(): Observable<{ eligible: boolean; blockers: string[] }> {
    return this.http
      .get<any>(`${this.apiUrl}/profile-verification/eligibility`)
      .pipe(map((res) => this.unwrap<{ eligible: boolean; blockers: string[] }>(res)));
  }

  listModeration(status = 'all', page = 1, limit = 20) {
    const params = new HttpParams()
      .set('status', status)
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http
      .get<any>(`${this.apiUrl}/admin/profile-moderation`, { params })
      .pipe(map((res) => this.unwrap<{ items: ModerationRow[]; total: number; page: number; limit: number }>(res)));
  }

  getModerationDetail(userType: string, userId: string): Observable<ProfileVerificationDashboard> {
    return this.http
      .get<any>(`${this.apiUrl}/admin/profile-moderation/${userType}/${userId}`)
      .pipe(map((res) => this.unwrap<ProfileVerificationDashboard>(res)));
  }

  action(userType: string, userId: string, action: string, notes = '') {
    return this.http
      .post<any>(`${this.apiUrl}/admin/profile-moderation/${userType}/${userId}/action`, {
        action,
        notes,
      })
      .pipe(map((res) => this.unwrap<ProfileVerificationDashboard>(res)));
  }

  updateChecks(userType: string, userId: string, checks: Record<string, boolean>) {
    return this.http
      .patch<any>(`${this.apiUrl}/admin/profile-moderation/${userType}/${userId}/checks`, checks)
      .pipe(map((res) => this.unwrap<ProfileVerificationDashboard>(res)));
  }

  addFlag(userType: string, userId: string, flag: Partial<ProfileFlag>) {
    return this.http
      .post<any>(`${this.apiUrl}/admin/profile-moderation/${userType}/${userId}/flags`, flag)
      .pipe(map((res) => this.unwrap<ProfileFlag>(res)));
  }

  updateFlag(flagId: string, patch: Partial<ProfileFlag> & { reviewNotes?: string }) {
    return this.http
      .patch<any>(`${this.apiUrl}/admin/profile-moderation/flags/${flagId}`, patch)
      .pipe(map((res) => this.unwrap<ProfileFlag>(res)));
  }

  contactVerification(userType: string, userId: string, payload: Record<string, any>) {
    const type = userType.toLowerCase();
    return this.http
      .patch<any>(`${this.apiUrl}/admin/users/${type}/${userId}/contact-verification`, payload)
      .pipe(map((res) => this.unwrap<any>(res)));
  }
}
