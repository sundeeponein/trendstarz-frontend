import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { buildSocialProfileUrl } from '../../../shared/social-handle.util';
import { SessionService } from '../../../core/session.service';

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
    /** Same channel found by its id under this new handle (renamed on YouTube). */
    handleChangedTo?: string | null;
    /** 2+ lookups in a row found no channel for the creator's handle. */
    notFound?: boolean;
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

  /** Row awaiting confirmation of "change to the observed tier & verify". */
  moving: TierReviewItem | null = null;
  movingSaving = false;
  movingError = '';

  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
    private session: SessionService,
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

  // ── Change the declared tier to the observed one, then verify it ──

  /**
   * Offered only when a fresh/stale observation puts the account in a different,
   * real tier (not "below starter" — there is no tier to move to).
   */
  observedTierToApply(item: TierReviewItem): string | null {
    const t = item.observed.tier;
    if (!item.observedUsable || item.declaredVsObserved !== 'mismatch' || !t) return null;
    if (t.key === 'below_starter') return null;
    return t.label;
  }

  isMoving(item: TierReviewItem): boolean {
    return this.trackItem(0, item) === (this.moving ? this.trackItem(0, this.moving) : '');
  }

  askMove(item: TierReviewItem): void {
    this.moving = item;
    this.deciding = null;
    this.movingError = '';
    this.cdr.markForCheck();
  }

  cancelMove(): void {
    this.moving = null;
    this.movingError = '';
    this.cdr.markForCheck();
  }

  /**
   * Two existing admin routes, in order: the user pop-up's tier edit (logged, and the
   * creator gets the usual "admin changed your tier" notice), then a tier verification
   * on the observed evidence. If the second step fails, the tier is already changed
   * and the row stays in the queue to verify by hand.
   */
  confirmMove(): void {
    const item = this.moving;
    const tier = item ? this.observedTierToApply(item) : null;
    if (!item || !tier || this.movingSaving) return;
    this.movingSaving = true;
    this.movingError = '';
    const admin: any = this.session.getUser() || {};
    const account =
      `${this.base}/admin/users/${item.profileType.toLowerCase()}/${encodeURIComponent(item.profileId)}` +
      `/social-accounts/${encodeURIComponent(item.socialAccountId)}`;
    const from = item.declaredTierRef?.label || item.declaredTier;
    this.http
      .patch<any>(account, {
        tier,
        changedBy: String(admin.id || admin._id || ''),
        changedByName: String(admin.name || admin.email || 'Admin'),
      })
      .subscribe({
        next: () => {
          this.http
            .patch<any>(`${account}/tier-verification`, {
              status: 'verified',
              evidenceBasis: 'observed',
              expectedTier: tier,
              note: `Changed from ${from} to the observed tier (${tier}).`,
            })
            .subscribe({
              next: () => this.moveDone(item, `tier changed ${from} → ${tier} and verified.`),
              error: (err) =>
                this.moveDone(
                  item,
                  `tier changed ${from} → ${tier}, but not verified (${err?.error?.message || 'error'}) — verify it in the queue.`,
                ),
            });
        },
        error: (err) => {
          this.movingSaving = false;
          this.movingError = err?.error?.message || 'The tier could not be changed.';
          this.cdr.markForCheck();
        },
      });
  }

  private moveDone(item: TierReviewItem, text: string): void {
    this.movingSaving = false;
    this.moving = null;
    this.lastDone = `${item.creatorName || item.username} · ${item.platform}: ${text}`;
    this.load();
  }

  trackItem(_: number, item: TierReviewItem): string {
    return `${item.profileType}|${item.profileId}|${item.socialAccountId}`;
  }
}
