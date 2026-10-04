import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AppPaginatorComponent } from '../../../../shared/components/app-paginator/app-paginator.component';
import { environment } from '../../../../../environments/environment';

// Stage 3B-3: GET admin/matching/eligibility/:campaignId — grouped, not ranked.
export type EligibilityStatus = 'PASS' | 'UNKNOWN' | 'FAIL';
export type EligibilityRequirementKey =
  | 'accountApproval'
  | 'creatorType'
  | 'platformContent'
  | 'category'
  | 'minimumTier'
  | 'location'
  | 'language';

interface StatusCounts {
  PASS: number;
  UNKNOWN: number;
  FAIL: number;
}

export interface CampaignEligibilityRow {
  creatorId: string;
  creatorType: 'Influencer' | 'Photographer';
  name: string;
  username: string;
  publicId: string;
  overall: EligibilityStatus;
  requirements: Record<
    EligibilityRequirementKey,
    { status: EligibilityStatus; reason: string; configured: boolean }
  >;
  /** Already holds an invite for this campaign (any status). Separate from eligibility. */
  invited: boolean;
  /** Decided by the backend (live campaign + PASS + not invited); re-checked again at send time. */
  invitable: boolean;
  inviteBlockedReason: string | null;
}

// Stage 3B-4: POST admin/matching/eligibility/:campaignId/invites
export interface EligibilityInviteOutcome {
  requested: number;
  invited: Array<{ creatorId: string; inviteId: string }>;
  skipped: Array<{
    creatorId: string;
    code:
      | 'invalid_id'
      | 'unavailable'
      | 'already_invited'
      | 'not_eligible'
      | 'eligibility_unknown'
      | 'invite_rejected';
    reason: string;
  }>;
}

export const MAX_INVITES_PER_REQUEST = 50;

export interface CampaignEligibilityList {
  campaign: {
    campaignId: string;
    title: string;
    status: string;
    invitesOpen: boolean;
    invitesClosedReason: string | null;
    recipientRole: 'influencer' | 'photographer';
    ownerType: 'brand' | 'photographer';
    requirements: {
      platforms: string[];
      contentTypes: string[];
      categories: string[];
      targetCreatorCategories: string[];
      minimumTier: string | null;
      location: { state: string | null; district: string | null };
      languages: string[];
    };
  };
  scope: {
    creatorType: 'Influencer' | 'Photographer';
    evaluated: number;
    alreadyInvited: number;
  };
  counts: StatusCounts;
  requirementCounts: Record<EligibilityRequirementKey, StatusCounts & { configured: boolean }>;
  total: number;
  rows: CampaignEligibilityRow[];
  notEvaluated: Array<{ input: string; reason: string }>;
}

type ApiEnvelope<T> = { success?: boolean; data?: T } & Partial<T>;
function unwrapApiData<T>(res: ApiEnvelope<T> | null | undefined): T | undefined {
  if (!res) return undefined;
  return (res.data ?? res) as T;
}

export const ELIGIBILITY_REQUIREMENTS: Array<{ key: EligibilityRequirementKey; label: string }> = [
  { key: 'accountApproval', label: 'Approval' },
  { key: 'creatorType', label: 'Creator type' },
  { key: 'platformContent', label: 'Platform / content' },
  { key: 'category', label: 'Category' },
  { key: 'minimumTier', label: 'Tier' },
  { key: 'location', label: 'Location' },
  { key: 'language', label: 'Language' },
];

@Component({
  selector: 'app-campaign-eligibility-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AppPaginatorComponent],
  templateUrl: './campaign-eligibility-panel.component.html',
  styleUrls: ['./campaign-eligibility-panel.component.scss'],
})
export class CampaignEligibilityPanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) campaignId = '';
  @Input() campaignTitle = '';
  @Output() close = new EventEmitter<void>();

  readonly statuses: EligibilityStatus[] = ['PASS', 'UNKNOWN', 'FAIL'];
  readonly requirements = ELIGIBILITY_REQUIREMENTS;
  readonly pageSizeOptions = [10, 25, 50, 100];

  selectedStatuses = new Set<EligibilityStatus>(['PASS', 'UNKNOWN']);
  requirementFilter: EligibilityRequirementKey | '' = '';
  searchQuery = '';
  currentPage = 1;
  pageSize = 25;

  data: CampaignEligibilityList | null = null;
  loading = false;
  error = '';
  showNotEvaluated = false;

  // Stage 3B-4: admin picks eligible creators and invites them as the campaign owner.
  /** creatorId → display name, kept across pages until sent. */
  selected = new Map<string, string>();
  confirmingInvite = false;
  sendingInvites = false;
  inviteOutcome: EligibilityInviteOutcome | null = null;
  inviteError = '';
  private inviteNames = new Map<string, string>();

  private request: Subscription | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  private authHeaders() {
    const token =
      typeof window === 'undefined'
        ? null
        : localStorage.getItem('token') || sessionStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  buildQuery(): string {
    const params = new URLSearchParams({
      status: this.statuses.filter((s) => this.selectedStatuses.has(s)).join(','),
      page: String(this.currentPage),
      pageSize: String(this.pageSize),
    });
    if (this.requirementFilter) params.set('requirement', this.requirementFilter);
    if (this.searchQuery.trim()) params.set('q', this.searchQuery.trim());
    return params.toString();
  }

  load(): void {
    if (!this.campaignId) return;
    this.request?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.request = this.http
      .get<ApiEnvelope<CampaignEligibilityList>>(
        `${environment.apiBaseUrl}/admin/matching/eligibility/${encodeURIComponent(this.campaignId)}?${this.buildQuery()}`,
        this.authHeaders(),
      )
      .subscribe({
        next: (res) => {
          this.data = unwrapApiData(res) ?? null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not load creator eligibility.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  get allStatusesSelected(): boolean {
    return this.statuses.every((s) => this.selectedStatuses.has(s));
  }

  showAllStatuses(): void {
    if (this.allStatusesSelected) return;
    this.statuses.forEach((s) => this.selectedStatuses.add(s));
    this.currentPage = 1;
    this.load();
  }

  toggleStatus(status: EligibilityStatus): void {
    if (this.selectedStatuses.has(status)) {
      // Keep at least one group selected (the backend would fall back to its default).
      if (this.selectedStatuses.size === 1) return;
      this.selectedStatuses.delete(status);
    } else {
      this.selectedStatuses.add(status);
    }
    this.currentPage = 1;
    this.load();
  }

  onRequirementFilterChange(): void {
    this.currentPage = 1;
    this.load();
  }

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.load();
    }, 300);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.load();
  }

  statusLabel(status: EligibilityStatus): string {
    return status === 'PASS' ? 'Eligible' : status === 'UNKNOWN' ? 'Unknown' : 'Not eligible';
  }

  /** Requirements the row does not pass, with the backend's reason. */
  openIssues(
    row: CampaignEligibilityRow,
  ): Array<{ label: string; status: EligibilityStatus; reason: string }> {
    return this.requirements
      .map(({ key, label }) => ({ label, ...row.requirements[key] }))
      .filter((r) => r.status !== 'PASS')
      .map(({ label, status, reason }) => ({ label, status, reason }));
  }

  requirementChips(): Array<{ label: string; value: string }> {
    const r = this.data?.campaign.requirements;
    if (!r) return [];
    const list = (values: string[]) => (values.length ? values.join(', ') : 'Any');
    const location = [r.location.district, r.location.state].filter(Boolean).join(', ');
    const photographerOwned = this.data?.campaign.ownerType === 'photographer';
    return [
      {
        label: 'Creators',
        value: this.data?.scope.creatorType === 'Photographer' ? 'Photographers' : 'Influencers',
      },
      { label: 'Platforms', value: list(r.platforms) },
      { label: 'Content', value: list(r.contentTypes.map((c) => c.replace(':', ' · '))) },
      {
        label: 'Categories',
        value: list(photographerOwned ? r.targetCreatorCategories : r.categories),
      },
      { label: 'Tier', value: r.minimumTier ? `${r.minimumTier} or above` : 'Any' },
      { label: 'Location', value: location || 'Any' },
      { label: 'Languages', value: list(r.languages) },
    ];
  }

  /** From the backend: campaign status + acceptance deadline. */
  get canInvite(): boolean {
    return !!this.data?.campaign.invitesOpen;
  }

  /** The backend decides; the browser only mirrors it (and the server re-checks at send). */
  isSelectable(row: CampaignEligibilityRow): boolean {
    return this.canInvite && row.invitable === true;
  }

  toggleSelected(row: CampaignEligibilityRow): void {
    if (!this.isSelectable(row)) return;
    if (this.selected.has(row.creatorId)) this.selected.delete(row.creatorId);
    else if (this.selected.size < MAX_INVITES_PER_REQUEST)
      this.selected.set(row.creatorId, this.displayName(row));
    this.confirmingInvite = false;
  }

  get selectableOnPage(): CampaignEligibilityRow[] {
    return (this.data?.rows || []).filter((r) => this.isSelectable(r));
  }

  get allOnPageSelected(): boolean {
    const rows = this.selectableOnPage;
    return rows.length > 0 && rows.every((r) => this.selected.has(r.creatorId));
  }

  toggleSelectPage(): void {
    const rows = this.selectableOnPage;
    if (this.allOnPageSelected) rows.forEach((r) => this.selected.delete(r.creatorId));
    else
      for (const r of rows) {
        if (this.selected.size >= MAX_INVITES_PER_REQUEST) break;
        this.selected.set(r.creatorId, this.displayName(r));
      }
    this.confirmingInvite = false;
  }

  clearSelection(): void {
    this.selected.clear();
    this.confirmingInvite = false;
  }

  sendInvites(): void {
    if (!this.selected.size || this.sendingInvites) return;
    this.sendingInvites = true;
    this.inviteError = '';
    this.inviteOutcome = null;
    this.inviteNames = new Map(this.selected);
    this.http
      .post<ApiEnvelope<EligibilityInviteOutcome>>(
        `${environment.apiBaseUrl}/admin/matching/eligibility/${encodeURIComponent(this.campaignId)}/invites`,
        { creatorIds: [...this.selected.keys()] },
        this.authHeaders(),
      )
      .subscribe({
        next: (res) => {
          this.inviteOutcome = unwrapApiData(res) ?? null;
          this.sendingInvites = false;
          this.confirmingInvite = false;
          this.selected.clear();
          this.load();
        },
        error: (err) => {
          this.inviteError = err?.error?.message || 'Could not send invites.';
          this.sendingInvites = false;
          this.confirmingInvite = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Selection went stale: eligibility or invite state changed after the list was loaded. */
  needsReview(code: EligibilityInviteOutcome['skipped'][number]['code']): boolean {
    return code === 'not_eligible' || code === 'eligibility_unknown' || code === 'unavailable';
  }

  inviteName(creatorId: string): string {
    return this.inviteNames.get(creatorId) || creatorId;
  }

  private displayName(row: CampaignEligibilityRow): string {
    return row.name || (row.username ? `@${row.username}` : row.creatorId);
  }

  trackRow(_: number, row: CampaignEligibilityRow): string {
    return row.creatorId;
  }
}
