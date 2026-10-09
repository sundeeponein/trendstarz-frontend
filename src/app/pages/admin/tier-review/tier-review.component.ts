import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { buildSocialProfileUrl } from '../../../shared/social-handle.util';

/**
 * Stage 3D-1b — Tier review queue (admin).
 *
 * Lists, across all approved creators, the social accounts whose declared tier
 * needs a decision (changed since review → observation disagrees → never
 * reviewed). The server builds the queue (GET admin/tier-review); decisions go
 * through the existing tier-verification route, with the evidence they rest on.
 * Observation is evidence only — the admin decides.
 */

export type TierReviewReason = 'changed_since_review' | 'observed_mismatch' | 'never_reviewed';
export interface TierRef {
  key: string;
  label: string;
}
export interface TierReviewItem {
  reason: TierReviewReason;
  since: string | null;
  profileType: 'Influencer' | 'Photographer';
  profileId: string;
  creatorName: string;
  username: string;
  socialAccountId: string;
  platform: string;
  platformKey: string;
  handle: string;
  declaredTier: string;
  declaredTierRef: TierRef | null;
  decision: {
    status: string;
    decidedTier: string | null;
    decidedAt: string | null;
    decidedByName: string | null;
    evidenceBasis: string | null;
    invalidatedAt: string | null;
  };
  observed: {
    followers: number | null;
    tier: TierRef | null;
    capturedAt: string | null;
    freshness: 'fresh' | 'stale' | 'expired' | 'never';
    requiresConnection: boolean;
    connected: boolean | null;
    lastAttemptFailed: boolean;
    /** The exact page the platform resolved the account to (e.g. the YouTube channel). */
    externalUrl?: string | null;
  };
  declaredVsObserved: 'match' | 'mismatch' | 'not_available';
  observedUsable: boolean;
  /** The creator's saved profile link, when it is a web link. */
  profileUrl?: string | null;
}
export interface TierReviewPage {
  asOf: string;
  counts: Record<TierReviewReason, number>;
  total: number;
  platforms: Record<string, number>;
  filtered: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: TierReviewItem[];
}

export const REASON_LABELS: Record<TierReviewReason, string> = {
  changed_since_review: 'Changed since review',
  observed_mismatch: 'Observation disagrees',
  never_reviewed: 'Never reviewed',
};

const FRESHNESS_LABELS: Record<string, string> = {
  fresh: 'fresh',
  stale: 'stale',
  expired: 'expired',
  never: 'never observed',
};

type Basis = 'observed' | 'manual_check';
interface DecisionDraft {
  status: 'verified' | 'rejected';
  basis: Basis;
  note: string;
}

@Component({
  selector: 'app-tier-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './tier-review.component.html',
  styleUrls: ['./tier-review.component.scss'],
})
export class TierReviewComponent implements OnInit {
  readonly reasons: TierReviewReason[] = ['changed_since_review', 'observed_mismatch', 'never_reviewed'];
  readonly reasonLabels = REASON_LABELS;

  data: TierReviewPage | null = null;
  loading = false;
  error = '';

  reason: TierReviewReason | '' = '';
  platform = '';
  q = '';
  page = 1;
  readonly pageSize = 25;

  /** The row being decided (one at a time). */
  deciding: TierReviewItem | null = null;
  draft: DecisionDraft = { status: 'verified', basis: 'manual_check', note: '' };
  saving = false;
  decisionError = '';
  lastDone = '';

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

  private get base(): string {
    return environment.apiBaseUrl;
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const params = new URLSearchParams({ page: String(this.page), pageSize: String(this.pageSize) });
    if (this.reason) params.set('reason', this.reason);
    if (this.platform) params.set('platform', this.platform);
    if (this.q.trim()) params.set('q', this.q.trim());
    this.http.get<any>(`${this.base}/admin/tier-review?${params.toString()}`).subscribe({
      next: (res) => {
        this.data = (res?.data ?? res) || null;
        this.page = this.data?.page ?? 1;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not load the tier review queue.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  setReason(r: TierReviewReason | ''): void {
    this.reason = r;
    this.page = 1;
    this.load();
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  goToPage(p: number): void {
    if (!this.data || p < 1 || p > this.data.totalPages) return;
    this.page = p;
    this.load();
  }

  get platformOptions(): string[] {
    return Object.keys(this.data?.platforms || {}).sort();
  }

  /* ── display helpers ── */

  followersText(item: TierReviewItem): string {
    const o = item.observed;
    if (o.followers !== null) return `${o.followers.toLocaleString('en-IN')} followers`;
    if (o.capturedAt) return 'count not available';
    if (o.requiresConnection && !o.connected) return 'not connected';
    return 'not observed';
  }

  /** The account's page: the creator's saved link, else built from the handle (same as the user pop-up). */
  accountLink(item: TierReviewItem): string {
    return item.profileUrl || buildSocialProfileUrl(item.platform, item.handle) || '';
  }

  platformIcon(item: TierReviewItem): string {
    const key = String(item.platformKey || '').toLowerCase();
    const icons: Record<string, string> = {
      instagram: 'bi-instagram',
      youtube: 'bi-youtube',
      facebook: 'bi-facebook',
      linkedin: 'bi-linkedin',
      x: 'bi-twitter-x',
    };
    return icons[key] || 'bi-link-45deg';
  }

  freshnessText(item: TierReviewItem): string {
    return FRESHNESS_LABELS[item.observed.freshness] || item.observed.freshness;
  }

  basisText(basis: string | null): string {
    return basis === 'observed' ? 'observed' : basis === 'manual_check' ? 'manual check' : '';
  }

  /* ── deciding ── */

  open(item: TierReviewItem, status: 'verified' | 'rejected'): void {
    this.deciding = item;
    // Default to the strongest evidence the server will accept for this account.
    this.draft = { status, basis: item.observedUsable ? 'observed' : 'manual_check', note: '' };
    this.decisionError = '';
    this.cdr.markForCheck();
  }

  cancel(): void {
    this.deciding = null;
    this.decisionError = '';
    this.cdr.markForCheck();
  }

  isOpen(item: TierReviewItem): boolean {
    return (
      !!this.deciding &&
      this.deciding.profileId === item.profileId &&
      this.deciding.socialAccountId === item.socialAccountId
    );
  }

  save(): void {
    const item = this.deciding;
    if (!item || this.saving) return;
    this.saving = true;
    this.decisionError = '';
    const type = item.profileType.toLowerCase();
    const url =
      `${this.base}/admin/users/${type}/${encodeURIComponent(item.profileId)}` +
      `/social-accounts/${encodeURIComponent(item.socialAccountId)}/tier-verification`;
    this.http
      .patch<any>(url, {
        status: this.draft.status,
        note: this.draft.note.trim(),
        // The server refuses the decision if the declared tier changed since this page loaded.
        expectedTier: item.declaredTier,
        evidenceBasis: this.draft.basis,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.lastDone = `${item.creatorName || item.username} · ${item.platform}: tier ${
            this.draft.status === 'verified' ? 'verified' : 'rejected'
          }.`;
          this.deciding = null;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.decisionError = err?.error?.message || 'The decision could not be saved.';
          this.cdr.markForCheck();
        },
      });
  }

  trackItem(_: number, item: TierReviewItem): string {
    return `${item.profileType}|${item.profileId}|${item.socialAccountId}`;
  }
}
