import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

/**
 * Stage 3D-1m/3D-1a — Matching Evidence (admin, read-only).
 *
 * Displays the server's evidence-quality report (GET admin/matching/evidence-quality)
 * and the YouTube observation schedule status (GET admin/social-observation/youtube-schedule).
 * Calculates nothing itself and never writes: no observation, purge or ranking is triggered here.
 */

type Counts3 = { match: number; mismatch: number; not_available: number };
type Verification = {
  verified: number;
  rejected: number;
  never_reviewed: number;
  changed_since_review: number;
};
export interface PlatformEvidence {
  accounts: number;
  requiresConnection: number;
  connected: number;
  attempted: number;
  lastAttemptFailed: number;
  failureReasons: Record<string, number>;
  freshness: { fresh: number; stale: number; expired: number; never: number };
  usableObservedFollowers: number;
  usableObservedFollowersPct: number | null;
  handleConsistency: Counts3;
  declaredVsObservedTier: Counts3;
  ownership: Verification;
  tier: Verification;
  sample: 'sufficient' | 'insufficient';
}
interface CreatorData {
  creators: number;
  sample: string;
  activity: Record<string, number>;
  activityUnknownPct: number | null;
  categories: { perCreator: Record<string, number>; overCurrentCap: number; cap: number };
  rates: {
    enabledRows: number;
    pricedRows: number;
    belowProposedMinimum: number;
    multipleOf500: number;
    multipleOf500Pct: number | null;
    confirmationTracked: boolean;
    /** 3D-1d: rates the creator set or changed since tracking began. */
    confirmedRows?: number;
    confirmedPct?: number | null;
  };
  /** 3D-1d: explicit states; "not set" = never chosen (older "off" lands here). */
  availability: {
    available: number;
    notAvailable: number;
    notSet: number;
    explicitStateTracked: boolean;
  };
}
interface CampaignResolution {
  campaignId: string;
  campaignNumber: number | null;
  status: string;
  eligible: number;
  ranked: number;
  distinctSignalCombinations: number;
  creatorsInTieGroupsPct: number | null;
  largestTieGroup: number;
  decidedPairsPct: Record<'platformContent' | 'category' | 'activity' | 'creatorId', number | null>;
  topNCutoffInTie: Record<string, boolean | null>;
}
export interface EvidenceQualityReport {
  asOf: string;
  definitions: {
    minSampleSize: number;
    proposedThresholds: {
      observationFreshDays: number;
      observationExpiredAfterDays: number;
      minimumRateRupees: number;
    };
  };
  population: {
    influencers: { evaluated: number; approvedActive: number };
    photographers: { evaluated: number; approvedActive: number };
  };
  socialEvidence: { byPlatform: Record<string, PlatformEvidence>; overall: PlatformEvidence };
  creatorData: { influencers: CreatorData; photographers: CreatorData };
  outcomes: {
    total: number;
    live: number;
    backfilled: number;
    liveCaptureSince: Record<string, string>;
    byType: Record<string, { total: number; live: number; backfilled: number }>;
    approvedCreatorsWithAnyEvent: number;
    sample: string;
  };
  rankingResolution: {
    campaigns: CampaignResolution[];
    overall: {
      campaigns: number;
      ranked: number;
      creatorsInTieGroupsPct: number | null;
      decidedPairsPct: Record<string, number | null>;
      topNCutoffInTie: Record<string, { inTie: number; measurable: number }>;
    };
  };
}
export interface YoutubeScheduleStatus {
  enabled: boolean;
  switch: string;
  schedule: { refreshEveryDays: number; runsAt: string };
  retention: { maxAgeDays: number; countsOlderThanLimit: number };
  lastScheduledAttemptAt: string | null;
  candidates: number;
  dueNow: number;
  notDue: number;
  paused: Array<{
    handle: string;
    consecutiveFailures: number;
    lastError: string | null;
    nextRetryAt: string;
  }>;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  tiktok: 'TikTok',
};
const PLATFORM_ORDER = ['instagram', 'youtube', 'facebook', 'linkedin', 'x', 'tiktok'];

/** Brand colour of each platform's dot in the table. */
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#e1306c',
  youtube: '#ff0000',
  facebook: '#1877f2',
  linkedin: '#0a66c2',
  x: '#111111',
  tiktok: '#25f4ee',
};

/** Below this share of accounts with a usable observed count, the tile is flagged. */
const LOW_OBSERVED_COVERAGE_PCT = 25;

export const ACTIVITY_ROWS: Array<{ key: string; label: string }> = [
  { key: 'within_7_days', label: 'Within 7 days' },
  { key: 'within_8_30_days', label: '8–30 days' },
  { key: 'within_31_90_days', label: '31–90 days' },
  { key: 'over_90_days', label: 'More than 90 days' },
  { key: 'unknown', label: 'Unknown' },
];

@Component({
  selector: 'app-matching-evidence',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './matching-evidence.component.html',
  styleUrls: ['./matching-evidence.component.scss'],
})
export class MatchingEvidenceComponent implements OnInit {
  readonly activityRows = ACTIVITY_ROWS;
  report: EvidenceQualityReport | null = null;
  schedule: YoutubeScheduleStatus | null = null;
  scheduleError = '';
  loading = false;
  error = '';
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.scheduleError = '';
    const base = environment.apiBaseUrl;
    forkJoin({
      report: this.http.get<any>(`${base}/admin/matching/evidence-quality`),
      // The schedule card is optional: a failure there never hides the report.
      schedule: this.http
        .get<any>(`${base}/admin/social-observation/youtube-schedule`)
        .pipe(
          catchError((err) => {
            this.scheduleError = err?.error?.message || 'Schedule status unavailable.';
            return of(null);
          }),
        ),
    }).subscribe({
      next: ({ report, schedule }) => {
        this.report = (report?.data ?? report) || null;
        this.schedule = schedule ? (schedule?.data ?? schedule) : null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not load matching evidence.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get platforms(): Array<{ key: string; label: string; p: PlatformEvidence }> {
    const by = this.report?.socialEvidence.byPlatform || {};
    return Object.keys(by)
      .sort((a, b) => {
        const ia = PLATFORM_ORDER.indexOf(a);
        const ib = PLATFORM_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
      })
      .map((key) => ({ key, label: PLATFORM_LABELS[key] || key, p: by[key] }));
  }

  platformColor(key: string): string {
    return PLATFORM_COLORS[key] || '#9ca3af';
  }

  /** Approved share of a population, as a whole percentage (0 when empty). */
  share(p: { evaluated: number; approvedActive: number }): number {
    return p.evaluated > 0 ? Math.round((100 * p.approvedActive) / p.evaluated) : 0;
  }

  get lowObservedCoverage(): boolean {
    const v = this.report?.socialEvidence.overall.usableObservedFollowersPct;
    return v === null || v === undefined || v < LOW_OBSERVED_COVERAGE_PCT;
  }

  /** The activity window holding the most creators (highlighted); '' when all are empty. */
  activityPeak(d: CreatorData): string {
    let best = '';
    let max = 0;
    for (const row of ACTIVITY_ROWS) {
      const n = d.activity[row.key] || 0;
      if (n > max) {
        max = n;
        best = row.key;
      }
    }
    return best;
  }

  /** Observed (fresh or stale) — what the report counts as current evidence. */
  observed(p: PlatformEvidence): number {
    return p.freshness.fresh + p.freshness.stale;
  }

  pct(v: number | null | undefined): string {
    return v === null || v === undefined ? '—' : `${v}%`;
  }

  campaignLabel(c: CampaignResolution): string {
    return c.campaignNumber !== null ? `CMP-${c.campaignNumber}` : `…${c.campaignId.slice(-4)}`;
  }

  categoryRows(d: CreatorData): Array<{ label: string; count: number; overCap: boolean }> {
    return Object.entries(d.categories.perCreator)
      .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
      .map(([k, count]) => ({
        label: k === '1' ? '1 category' : `${k} categories`,
        count,
        // "6+" (or any number above the cap) is over the current limit.
        overCap: parseInt(k, 10) > d.categories.cap,
      }));
  }

  eventRows(): Array<{ type: string; total: number; live: number; backfilled: number }> {
    const by = this.report?.outcomes.byType || {};
    return Object.entries(by)
      .map(([type, v]) => ({ type: type.replace(/_/g, ' '), ...v }))
      .sort((a, b) => b.total - a.total);
  }

  cutoffText(k: 'top5' | 'top10' | 'top25'): string {
    const c = this.report?.rankingResolution.overall.topNCutoffInTie[k];
    return c ? `${c.inTie} of ${c.measurable}` : '—';
  }

  trackKey(_: number, item: { key?: string; campaignId?: string }): string {
    return item.key || item.campaignId || '';
  }
}
