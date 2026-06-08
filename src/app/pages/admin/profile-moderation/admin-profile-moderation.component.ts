import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ModerationRow,
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../../services/profile-verification.service';
import { VerificationStatusComponent } from '../../../shared/profile-verification/verification-status.component';
import { ProfileFlagsComponent } from '../../../shared/profile-verification/profile-flags.component';
import { FlagManagementDialogComponent } from './flag-management-dialog.component';

@Component({
  selector: 'app-admin-profile-moderation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    VerificationStatusComponent,
    ProfileFlagsComponent,
    FlagManagementDialogComponent,
  ],
  template: `
    <main class="moderation-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Moderation</p>
          <h1>Profile Review</h1>
        </div>
        <button type="button" class="refresh-btn" (click)="loadRows()">
          <i class="bi bi-arrow-clockwise"></i>
          Refresh
        </button>
      </div>

      <div class="toolbar">
        <select [(ngModel)]="filter" (ngModelChange)="loadRows()">
          <option value="all">All profiles</option>
          <option>Pending Review</option>
          <option>Action Required</option>
          <option>Verified</option>
          <option>Rejected</option>
        </select>
        <span>{{ total() }} profile{{ total() === 1 ? '' : 's' }}</span>
      </div>

      <div class="alert alert-danger" *ngIf="error()">{{ error() }}</div>

      <div class="layout">
        <section class="table-panel">
          <div class="loading" *ngIf="loadingRows()">
            <div class="spinner-border text-warning" role="status"></div>
          </div>

          <button
            type="button"
            class="user-row"
            *ngFor="let row of rows()"
            [class.selected]="selectedRow()?.userId === row.userId"
            (click)="select(row)"
          >
            <span class="avatar">{{ row.name.slice(0, 1) }}</span>
            <span class="row-main">
              <strong>{{ row.name }}</strong>
              <span>{{ row.userType }} · {{ row.email }}</span>
            </span>
            <span class="row-metrics">
              <b>{{ row.profileCompletion || 0 }}%</b>
              <span>{{ row.profileQualityScore }}/100</span>
            </span>
            <span class="flag-count" [class.open]="row.openFlagsCount > 0">{{ row.openFlagsCount }}</span>
          </button>

          <div class="empty" *ngIf="!loadingRows() && !rows().length">
            <i class="bi bi-patch-check"></i>
            No profiles match this filter.
          </div>
        </section>

        <section class="detail-panel" *ngIf="selectedDetail() as detail">
          <div class="detail-header">
            <div>
              <p class="eyebrow">{{ detail.userType }}</p>
              <h2>{{ detail.displayName }}</h2>
            </div>
            <span class="status-chip">{{ detail.verificationStatus }}</span>
          </div>

          <app-verification-status
            [completion]="detail.profileCompletion"
            [qualityScore]="detail.profileQualityScore"
            [qualityLabel]="detail.profileQualityLabel"
            [status]="detail.verificationStatus"
            [checklist]="detail.checklist"
          />

          <app-profile-flags
            title="Open Flags"
            [flags]="detail.actionRequired"
            [editable]="true"
            [showAdd]="true"
            (addFlag)="flagDialogOpen.set(true)"
            (updateFlag)="updateFlag($event.flag, $event.status)"
          />

          <div class="notes">
            <label>
              Review notes
              <textarea rows="3" [(ngModel)]="notes"></textarea>
            </label>
          </div>

          <div class="actions">
            <button type="button" class="approve" (click)="takeAction('approve')">Approve</button>
            <button type="button" class="warning" (click)="takeAction('approve_warning')">Approve with warning</button>
            <button type="button" class="changes" (click)="takeAction('request_changes')">Request changes</button>
            <button type="button" class="reject" (click)="takeAction('reject')">Reject</button>
          </div>
        </section>

        <section class="detail-panel placeholder" *ngIf="!selectedDetail()">
          <i class="bi bi-person-check"></i>
          <span>Select a profile to review.</span>
        </section>
      </div>
    </main>

    <app-flag-management-dialog
      [open]="flagDialogOpen()"
      (close)="flagDialogOpen.set(false)"
      (save)="addFlag($event)"
    />
  `,
  styles: [`
    .moderation-page {
      padding: 1.4rem;
      display: grid;
      gap: 1rem;
    }
    .page-header,
    .toolbar,
    .detail-header,
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .eyebrow {
      margin: 0 0 0.2rem;
      color: #657082;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    h1,
    h2 {
      margin: 0;
      color: #16162f;
      font-weight: 900;
    }
    h1 { font-size: 1.7rem; }
    h2 { font-size: 1.3rem; }
    .refresh-btn,
    .toolbar select,
    .actions button {
      border: 1px solid #d7deea;
      border-radius: 9px;
      background: #fff;
      color: #16162f;
      padding: 0.55rem 0.8rem;
      font-weight: 800;
    }
    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .toolbar {
      justify-content: flex-start;
      color: #657082;
      font-weight: 800;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(320px, 0.95fr) minmax(420px, 1.35fr);
      gap: 1rem;
      align-items: start;
    }
    .table-panel,
    .detail-panel {
      background: #fff;
      border: 1px solid #e1e6ef;
      border-radius: 12px;
      padding: 1rem;
    }
    .table-panel {
      display: grid;
      gap: 0.55rem;
    }
    .user-row {
      width: 100%;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) auto 36px;
      gap: 0.7rem;
      align-items: center;
      text-align: left;
      border: 1px solid #edf1f6;
      border-radius: 10px;
      background: #fbfcfe;
      padding: 0.7rem;
    }
    .user-row.selected {
      border-color: #e8580c;
      background: #fff8f4;
    }
    .avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #eef1f6;
      color: #16162f;
      font-weight: 900;
      text-transform: uppercase;
    }
    .row-main {
      min-width: 0;
      display: grid;
      gap: 0.1rem;
    }
    .row-main strong,
    .row-main span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row-main strong {
      color: #16162f;
      font-size: 0.95rem;
    }
    .row-main span,
    .row-metrics span {
      color: #64748b;
      font-size: 0.78rem;
    }
    .row-metrics {
      display: grid;
      justify-items: end;
      color: #16162f;
    }
    .flag-count {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #eef1f6;
      color: #64748b;
      font-weight: 900;
    }
    .flag-count.open {
      background: #fff0ef;
      color: #bd2d20;
    }
    .detail-panel {
      display: grid;
      gap: 1rem;
    }
    .status-chip {
      border-radius: 999px;
      background: #eef1f6;
      color: #16162f;
      padding: 0.3rem 0.7rem;
      font-weight: 900;
    }
    .notes label {
      display: grid;
      gap: 0.35rem;
      color: #465468;
      font-size: 0.82rem;
      font-weight: 800;
    }
    .notes textarea {
      border: 1px solid #d7deea;
      border-radius: 9px;
      padding: 0.6rem 0.7rem;
      font: inherit;
    }
    .actions {
      justify-content: flex-start;
    }
    .actions .approve { background: #2da64a; border-color: #2da64a; color: #fff; }
    .actions .warning { background: #fff5e5; border-color: #ffd89b; color: #9b4b00; }
    .actions .changes { background: #e8580c; border-color: #e8580c; color: #fff; }
    .actions .reject { background: #fff0ef; border-color: #ffc9bf; color: #bd2d20; }
    .loading,
    .empty,
    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      min-height: 180px;
      font-weight: 800;
    }
    .placeholder {
      flex-direction: column;
    }
    .placeholder i {
      font-size: 2rem;
      color: #e8580c;
    }
    @media (max-width: 980px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 560px) {
      .user-row {
        grid-template-columns: 38px minmax(0, 1fr) 32px;
      }
      .row-metrics {
        display: none;
      }
    }
  `],
})
export class AdminProfileModerationComponent implements OnInit {
  rows = signal<ModerationRow[]>([]);
  total = signal(0);
  selectedRow = signal<ModerationRow | null>(null);
  selectedDetail = signal<ProfileVerificationDashboard | null>(null);
  loadingRows = signal(true);
  error = signal('');
  flagDialogOpen = signal(false);
  filter = 'all';
  notes = '';
  private pendingUserType = '';
  private pendingUserId = '';

  constructor(private api: ProfileVerificationService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const snapshot = this.route.snapshot.queryParamMap;
    this.pendingUserType = snapshot.get('userType') || '';
    this.pendingUserId = snapshot.get('userId') || '';
    this.loadRows();
  }

  loadRows(): void {
    this.loadingRows.set(true);
    this.error.set('');
    this.api.listModeration(this.filter).subscribe({
      next: (res) => {
        this.rows.set(res.items || []);
        this.total.set(res.total || 0);
        this.loadingRows.set(false);
        this.selectPendingRow();
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load profiles.');
        this.loadingRows.set(false);
      },
    });
  }

  private selectPendingRow(): void {
    if (!this.pendingUserId || !this.pendingUserType) return;
    const row = this.rows().find(
      (item) =>
        String(item.userId || '') === this.pendingUserId &&
        String(item.userType || '') === this.pendingUserType,
    );
    if (!row) return;
    this.pendingUserId = '';
    this.pendingUserType = '';
    this.select(row);
  }

  select(row: ModerationRow): void {
    this.selectedRow.set(row);
    this.selectedDetail.set(null);
    this.notes = '';
    this.api.getModerationDetail(row.userType, row.userId).subscribe({
      next: (detail) => this.selectedDetail.set(detail),
      error: (err) => this.error.set(err?.error?.message || 'Failed to load profile detail.'),
    });
  }

  refreshSelected(): void {
    const row = this.selectedRow();
    if (row) this.select(row);
    this.loadRows();
  }

  takeAction(action: string): void {
    const row = this.selectedRow();
    if (!row) return;
    this.api.action(row.userType, row.userId, action, this.notes).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.loadRows();
      },
      error: (err) => this.error.set(err?.error?.message || 'Action failed.'),
    });
  }

  updateFlag(flag: any, status: 'Resolved' | 'Ignored'): void {
    const flagId = flag?._id || flag?.id;
    if (!flagId) return;
    this.api.updateFlag(flagId, { status, reviewNotes: this.notes }).subscribe({
      next: () => this.refreshSelected(),
      error: (err) => this.error.set(err?.error?.message || 'Flag update failed.'),
    });
  }

  addFlag(flag: any): void {
    const row = this.selectedRow();
    if (!row) return;
    this.api.addFlag(row.userType, row.userId, flag).subscribe({
      next: () => {
        this.flagDialogOpen.set(false);
        this.refreshSelected();
      },
      error: (err) => this.error.set(err?.error?.message || 'Flag creation failed.'),
    });
  }
}
