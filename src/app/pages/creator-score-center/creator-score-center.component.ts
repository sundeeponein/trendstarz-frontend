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

export type ScoreConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface ScoreConfidenceBasedOnItem {
  met: boolean;
  label: string;
  absentLabel: string;
}

export interface ScoreConfidence {
  level: ScoreConfidenceLevel;
  basedOn: ScoreConfidenceBasedOnItem[];
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
  /** Fetched once here and passed to the embedded full card too, instead of it fetching its own copy. */
  connections: SocialConnections | null = null;

  expandedVersion: number | null = null;
  expandedDetail: CollaborationAudit | null = null;
  expandedLoading = false;

  /** Future-ready — stay hidden until an admin feature-flag system exists to gate them. */
  readonly futureFeaturesEnabled = false;

  private userId = '';

  /**
   * How much real (API-verified or self-reported) data the current score is
   * actually based on — a rich, connected platform should read as more
   * trustworthy than a bare, unconnected one, for both the creator and any
   * brand who eventually sees this. Derived entirely from the existing
   * audit.platformsCollected confidence values — no new backend field.
   */
  get scoreConfidence(): ScoreConfidence | null {
    if (!this.audit) return null;
    const platforms = this.audit.platformsCollected || [];
    const maxConfidence = platforms.length ? Math.max(...platforms.map((p) => p.confidence || 0)) : 0;
    const level: ScoreConfidenceLevel = maxConfidence >= 85 ? 'High' : maxConfidence >= 50 ? 'Medium' : 'Low';

    const hasPlatform = (name: string) => platforms.some((p) => p.platform === name);
    const basedOn: ScoreConfidenceBasedOnItem[] = [
      { met: true, label: 'TrendStarZ Profile', absentLabel: 'TrendStarZ Profile' },
      { met: hasPlatform('YouTube'), label: 'YouTube', absentLabel: 'YouTube not added' },
      { met: hasPlatform('Instagram'), label: 'Instagram', absentLabel: 'Instagram not connected' },
      { met: hasPlatform('Facebook'), label: 'Facebook', absentLabel: 'Facebook not connected' },
      // LinkedIn has no OAuth support at all yet — never "met", always shown
      // as its own informational state rather than a real absent/connected pair.
      { met: false, label: 'LinkedIn', absentLabel: 'LinkedIn (Coming Soon)' },
    ];
    return { level, basedOn };
  }

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
      next: (connections) => {
        this.connections = connections;
        this.resolvePlatformStatus(connections, role);
      },
      error: () => {
        this.connections = { instagram: null, facebook: null };
        this.resolvePlatformStatus(this.connections, role);
      },
    });
  }

  private resolvePlatformStatus(connections: SocialConnections, role: string): void {
    const profile$ = role === 'photographer' ? this.config.getPhotographerProfileById() : this.config.getInfluencerProfileById();
    profile$.subscribe({
      next: (profile: any) => this.loadPlatformFlagsThenSetStatus(connections, profile),
      error: () => this.loadPlatformFlagsThenSetStatus(connections, null),
    });
  }

  private loadPlatformFlagsThenSetStatus(connections: SocialConnections, profile: any): void {
    this.api.getPlatformFlags().subscribe({
      next: (res) => this.setPlatformStatus(connections, profile, res.platformsEnabled),
      // Fetch failed — fail open (show every row) rather than hiding the
      // whole grid because of an unrelated network hiccup.
      error: () => this.setPlatformStatus(connections, profile, { instagram: true, youtube: true, facebook: true, linkedin: true }),
    });
  }

  private setPlatformStatus(
    connections: SocialConnections,
    profile: any,
    platformsEnabled: { instagram: boolean; youtube: boolean; facebook: boolean; linkedin: boolean },
  ): void {
    const hasYoutube = (profile?.socialMedia || []).some(
      (s: any) => String(s?.platform || '').toLowerCase() === 'youtube' && s?.handle,
    );
    const rows: Array<PlatformStatusRow & { enabled: boolean }> = [
      { platform: 'Instagram', icon: 'bi-instagram', status: connections.instagram ? 'Connected' : 'Not Connected', enabled: platformsEnabled.instagram },
      { platform: 'YouTube', icon: 'bi-youtube', status: hasYoutube ? 'Connected' : 'Not Connected', enabled: platformsEnabled.youtube },
      { platform: 'Facebook', icon: 'bi-facebook', status: connections.facebook ? 'Connected' : 'Not Connected', enabled: platformsEnabled.facebook },
      // LinkedIn stays visible regardless of its toggle — it's always "Coming
      // Soon" today (no collector exists yet), so admin-disabling it changes
      // nothing a user would see either way.
      { platform: 'LinkedIn', icon: 'bi-linkedin', status: 'Coming Soon', enabled: true },
    ];
    this.platformStatus = rows.filter((row) => row.enabled).map(({ enabled, ...row }) => row);
    this.cdr.detectChanges();
  }

  /** First-ever free audit only — CollaborationScoreCardComponent runs its own paid re-analysis flow internally. */
  onReAnalyze(): void {
    if (this.reAnalyzing) return;
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
