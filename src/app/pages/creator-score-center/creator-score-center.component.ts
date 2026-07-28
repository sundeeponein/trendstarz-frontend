import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import {
  CollaborationAudit,
  CollaborationAuditHistoryEntry,
  CollaborationScoreApiService,
  SocialConnections,
} from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';
import { CollaborationScoreCardComponent } from '../../shared/collaboration-score/collaboration-score-card.component';
import { ToastService } from '../../shared/toast/toast.service';

export type PlatformStatus = 'Connected' | 'Not Connected' | 'Coming Soon';

export interface PlatformStatusRow {
  platform: string;
  icon: string;
  status: PlatformStatus;
}

/**
 * The creator's permanent Score Center — everything that used to live
 * inline on the dashboard now lives here instead (see the dashboard's new
 * slim CollaborationScoreSummaryWidgetComponent, which just links here).
 * Brand accounts are redirected away — they don't have a personal score,
 * they view *other* creators' scores through Search instead.
 */
@Component({
  selector: 'app-creator-score-center',
  standalone: true,
  imports: [CommonModule, CollaborationScoreCardComponent],
  templateUrl: './creator-score-center.component.html',
  styleUrls: ['./creator-score-center.component.scss'],
})
export class CreatorScoreCenterComponent implements OnInit {
  audit: CollaborationAudit | null = null;
  loading = true;
  reAnalyzing = false;

  history: CollaborationAuditHistoryEntry[] = [];
  historyLoading = false;

  platformStatus: PlatformStatusRow[] = [];

  expandedVersion: number | null = null;
  expandedDetail: CollaborationAudit | null = null;
  expandedLoading = false;

  /** Future-ready — stay hidden until an admin feature-flag system exists to gate them. */
  readonly futureFeaturesEnabled = false;

  private userId = '';

  constructor(
    private readonly api: CollaborationScoreApiService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
    private readonly router: Router,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
    public readonly ui: CollaborationScoreUiUtilsService,
  ) {}

  ngOnInit(): void {
    const user: any = this.session.getUser() || {};
    const role = String(user?.role || '').toLowerCase();
    if (role === 'brand') {
      this.router.navigate(['/brand-dashboard']);
      return;
    }

    this.userId = String(user?._id || user?.id || '');
    if (!this.userId) return;

    this.loadAudit();
    this.loadHistory();
    this.loadPlatformStatus(role);
  }

  private loadAudit(): void {
    this.loading = true;
    this.api.getAudit(this.userId).subscribe({
      next: (audit) => {
        this.audit = audit;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.audit = null;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadHistory(): void {
    this.historyLoading = true;
    this.api.getAuditHistory(this.userId, 20).subscribe({
      next: (res) => {
        this.history = res?.history || [];
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.history = [];
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadPlatformStatus(role: string): void {
    this.api.getConnections().subscribe({
      next: (connections) => this.resolvePlatformStatus(connections, role),
      error: () => this.resolvePlatformStatus({ instagram: null, facebook: null }, role),
    });
  }

  private resolvePlatformStatus(connections: SocialConnections, role: string): void {
    const profile$ = role === 'photographer' ? this.config.getPhotographerProfileById() : this.config.getInfluencerProfileById();
    profile$.subscribe({
      next: (profile: any) => this.setPlatformStatus(connections, profile),
      error: () => this.setPlatformStatus(connections, null),
    });
  }

  private setPlatformStatus(connections: SocialConnections, profile: any): void {
    const hasYoutube = (profile?.socialMedia || []).some(
      (s: any) => String(s?.platform || '').toLowerCase() === 'youtube' && s?.handle,
    );
    this.platformStatus = [
      { platform: 'Instagram', icon: 'bi-instagram', status: connections.instagram ? 'Connected' : 'Not Connected' },
      { platform: 'YouTube', icon: 'bi-youtube', status: hasYoutube ? 'Connected' : 'Not Connected' },
      { platform: 'Facebook', icon: 'bi-facebook', status: connections.facebook ? 'Connected' : 'Not Connected' },
      { platform: 'LinkedIn', icon: 'bi-linkedin', status: 'Coming Soon' },
    ];
    this.cdr.detectChanges();
  }

  /** First-ever free audit only — CollaborationScoreCardComponent runs its own paid re-analysis flow internally. */
  onReAnalyze(): void {
    this.reAnalyzing = true;
    this.api.runMyAudit().subscribe({
      next: (audit) => {
        this.audit = audit;
        this.reAnalyzing = false;
        this.loadHistory();
        this.cdr.detectChanges();
      },
      error: () => {
        this.reAnalyzing = false;
        this.toast.error('Could not refresh your Collaboration Score. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  onAuditRefreshed(audit: CollaborationAudit): void {
    this.audit = audit;
    this.loadHistory();
  }

  toggleHistoryDetail(entry: CollaborationAuditHistoryEntry): void {
    if (this.expandedVersion === entry.version) {
      this.expandedVersion = null;
      this.expandedDetail = null;
      return;
    }
    this.expandedVersion = entry.version;
    this.expandedDetail = null;
    this.expandedLoading = true;
    this.api.getAuditVersion(this.userId, entry.version).subscribe({
      next: (detail) => {
        this.expandedDetail = detail;
        this.expandedLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.expandedLoading = false;
        this.toast.error('Could not load that audit.');
        this.cdr.detectChanges();
      },
    });
  }
}
