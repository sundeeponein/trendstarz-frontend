import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { AnalyticsService } from '../../core/analytics.service';
import {
  CollaborationAudit,
  CollaborationAuditHistoryEntry,
  CollaborationScoreApiService,
  SocialConnections,
} from '../../services/collaboration-score-api.service';
import { CollaborationScoreUiUtilsService, ScoreConfidence } from '../../services/collaboration-score-ui-utils.service';
import { CollaborationScoreCardComponent } from '../../shared/collaboration-score/collaboration-score-card.component';
import { ToastService } from '../../shared/toast/toast.service';

export type PlatformStatus = 'Connected' | 'Not Connected' | 'Coming Soon';

export interface PlatformStatusRow {
  platform: string;
  icon: string;
  status: PlatformStatus;
  /** Undefined until a sync-status/Sync response has been merged in. */
  lastSyncedAt?: string | null;
  hasChanges?: boolean;
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

  /** Delegated to CollaborationScoreUiUtilsService (shared with the card and the admin detail page). */
  get scoreConfidence(): ScoreConfidence | null {
    return this.ui.scoreConfidence(this.audit);
  }

  /** TrendStarZ admin-verification flag — fetched alongside platform status (see setPlatformStatus). */
  verified = false;

  syncing = false;
  private syncStatusByPlatform: Record<string, { lastSyncedAt: string | null; hasChanges: boolean }> = {};

  constructor(
    private readonly api: CollaborationScoreApiService,
    private readonly session: SessionService,
    private readonly config: ConfigService,
    private readonly router: Router,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
    private readonly analytics: AnalyticsService,
    private readonly ngZone: NgZone,
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
    this.loadSyncStatus();
  }

  /**
   * Read-only — reflects whatever the last Sync click (or a connect-time
   * free rescore) already recorded. Never fetches from Instagram/Facebook/
   * YouTube itself; that only happens when the creator explicitly clicks
   * "Sync Latest Profile" (see onSyncLatestProfile below).
   */
  private loadSyncStatus(): void {
    this.api.getSyncStatus().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.syncStatusByPlatform = Object.fromEntries(
            res.platforms.map((p) => [p.platform.toLowerCase(), { lastSyncedAt: p.lastSyncedAt, hasChanges: p.hasChanges }]),
          );
          this.mergeSyncStatusOntoRows();
          this.cdr.detectChanges();
        });
      },
      error: () => {},
    });
  }

  private mergeSyncStatusOntoRows(): void {
    this.platformStatus = this.platformStatus.map((row) => {
      const sync = this.syncStatusByPlatform[row.platform.toLowerCase()];
      return sync ? { ...row, lastSyncedAt: sync.lastSyncedAt, hasChanges: sync.hasChanges } : row;
    });
  }

  /** Free — fetches fresh platform data and compares it to the current audit. Never scores, never charges. */
  onSyncLatestProfile(): void {
    if (this.syncing) return;
    this.syncing = true;
    this.analytics.trackCollabSyncStarted();
    this.api.syncLatestProfile().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.syncing = false;
          this.syncStatusByPlatform = Object.fromEntries(
            res.platforms.map((p) => [p.platform.toLowerCase(), { lastSyncedAt: p.lastSyncedAt, hasChanges: p.hasChanges }]),
          );
          this.mergeSyncStatusOntoRows();
          this.analytics.trackCollabSyncCompleted({ success: true });
          if (res.hasChanges) {
            this.analytics.trackCollabSyncChangesDetected({
              platforms: res.platforms.filter((p) => p.hasChanges).map((p) => p.platform),
            });
          } else {
            this.analytics.trackCollabSyncNoChanges();
          }
          // Refresh the audit so the embedded card's canReanalyze/hasChanges
          // reflect this sync immediately, without a page reload.
          this.loadAudit();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.syncing = false;
          this.analytics.trackCollabSyncCompleted({ success: false });
          this.toast.error(err?.error?.message || 'Could not sync your profile. Please try again.');
          this.cdr.detectChanges();
        });
      },
    });
  }

  // HttpClient is configured with withFetch() (app.config.ts) — fetch()
  // promise continuations aren't always reliably re-entered into Angular's
  // zone, so state set in a plain .subscribe() callback can sit unrendered
  // until an unrelated zone-patched event (e.g. a click) forces a CD cycle.
  // Every subscribe callback in this component is wrapped in ngZone.run()
  // for that reason — same workaround used elsewhere in this app (see
  // score-preview.component.ts).
  private loadAudit(): void {
    this.loading = true;
    this.api.getAudit(this.userId).subscribe({
      next: (audit) => {
        this.ngZone.run(() => {
          this.audit = audit;
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.audit = null;
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  private loadHistory(): void {
    this.historyLoading = true;
    this.api.getAuditHistory(this.userId, 20).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.history = res?.history || [];
          this.historyLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.history = [];
          this.historyLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  private loadPlatformStatus(role: string): void {
    this.api.getConnections().subscribe({
      next: (connections) => {
        this.ngZone.run(() => {
          this.connections = connections;
          this.resolvePlatformStatus(connections, role);
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.connections = { instagram: null, facebook: null };
          this.resolvePlatformStatus(this.connections, role);
        });
      },
    });
  }

  private resolvePlatformStatus(connections: SocialConnections, role: string): void {
    const profile$ = role === 'photographer' ? this.config.getPhotographerProfileById() : this.config.getInfluencerProfileById();
    profile$.subscribe({
      next: (profile: any) => this.ngZone.run(() => this.loadPlatformFlagsThenSetStatus(connections, profile)),
      error: () => this.ngZone.run(() => this.loadPlatformFlagsThenSetStatus(connections, null)),
    });
  }

  private loadPlatformFlagsThenSetStatus(connections: SocialConnections, profile: any): void {
    this.api.getPlatformFlags().subscribe({
      next: (res) => this.ngZone.run(() => this.setPlatformStatus(connections, profile, res.platformsEnabled)),
      // Fetch failed — fail open (show every row) rather than hiding the
      // whole grid because of an unrelated network hiccup.
      error: () =>
        this.ngZone.run(() =>
          this.setPlatformStatus(connections, profile, { instagram: true, youtube: true, facebook: true, linkedin: true }),
        ),
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
    this.verified = profile?.verifiedByTrendStarz === true;
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
    this.mergeSyncStatusOntoRows();
    this.cdr.detectChanges();
  }

  /** First-ever free audit only — CollaborationScoreCardComponent runs its own paid re-analysis flow internally. */
  onReAnalyze(): void {
    if (this.reAnalyzing) return;
    this.reAnalyzing = true;
    this.api.runMyAudit().subscribe({
      next: (audit) => {
        this.ngZone.run(() => {
          this.audit = audit;
          this.reAnalyzing = false;
          this.loadHistory();
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.reAnalyzing = false;
          this.toast.error('Could not refresh your Collaboration Score. Please try again.');
          this.cdr.detectChanges();
        });
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
        this.ngZone.run(() => {
          this.expandedDetail = detail;
          this.expandedLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.expandedLoading = false;
          this.toast.error('Could not load that audit.');
          this.cdr.detectChanges();
        });
      },
    });
  }
}
