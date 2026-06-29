import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  ModerationRow,
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../../services/profile-verification.service';
import { ProfileReviewPanelComponent } from '../../../shared/profile-verification/profile-review-panel.component';
import { FlagManagementDialogComponent } from './flag-management-dialog.component';
import { VerificationFieldComponent } from '../../../shared/components/verification-field/verification-field.component';

@Component({
  selector: 'app-admin-profile-moderation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProfileReviewPanelComponent,
    FlagManagementDialogComponent,
    VerificationFieldComponent,
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
          <option value="Action Required">Needs Attention</option>
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
          <app-profile-review-panel
            [detail]="detail"
            [editable]="true"
            [showAddFlag]="true"
            [notes]="notes"
            (notesChange)="notes = $event"
            (addFlag)="flagDialogOpen.set(true)"
            (updateFlag)="updateFlag($event.flag, $event.status)"
            (action)="takeAction($event)"
          />

          <div class="verify-section">
            <h6 class="verify-section-title">Quick Verify</h6>
            <div class="verify-grid">
              <div>
                <app-verification-field
                  label="Email Address"
                  [status]="modIsEmailVerified(detail) ? 'Verified' : 'Pending'"
                  [value]="selectedRow()?.email || '-'"
                  [verified]="modIsEmailVerified(detail)"
                  (toggled)="modToggle('isEmailVerified', !modIsEmailVerified(detail))"
                ></app-verification-field>
              </div>
              <div>
                <app-verification-field
                  label="Mobile Number"
                  [status]="modIsMobileVerified(detail) ? 'Verified' : 'Pending'"
                  [value]="modIsMobileVerified(detail) ? 'Verified' : 'Pending'"
                  [verified]="modIsMobileVerified(detail)"
                  (toggled)="modToggle('isMobileVerified', !modIsMobileVerified(detail))"
                ></app-verification-field>
              </div>
              <div>
                <app-verification-field
                  label="Profile Photo"
                  [status]="modChecklistStatus(detail, 'profile photo')"
                  [value]="modChecklistStatus(detail, 'profile photo') || 'Pending'"
                  [verified]="modIsPhotoVerified(detail)"
                  (toggled)="modToggle('profilePhotoVerified', !modIsPhotoVerified(detail))"
                ></app-verification-field>
                <div class="flag-type-selector" *ngIf="!modIsPhotoVerified(detail)">
                  <span class="flag-type-label">Flag reason</span>
                  <div class="flag-type-btns">
                    <ng-container *ngFor="let opt of PHOTO_FLAG_OPTIONS">
                      <button *ngIf="!opt.policy"
                        type="button" class="flag-type-btn" [ngClass]="opt.cls"
                        [class.active]="modGetActivePhotoFlagCode(detail) === opt.code"
                        (click)="modSetPhotoFlagCode(opt.code)" [title]="opt.hint"
                      >{{ opt.label }}</button>
                    </ng-container>
                  </div>
                  <div class="flag-group-divider">
                    <span>Policy Violation — HIGH severity</span>
                  </div>
                  <div class="flag-type-btns">
                    <ng-container *ngFor="let opt of PHOTO_FLAG_OPTIONS">
                      <button *ngIf="opt.policy"
                        type="button" class="flag-type-btn" [ngClass]="opt.cls"
                        [class.active]="modGetActivePhotoFlagCode(detail) === opt.code"
                        (click)="modSetPhotoFlagCode(opt.code)" [title]="opt.hint"
                      >{{ opt.label }}</button>
                    </ng-container>
                  </div>
                </div>
              </div>
              <div>
                <app-verification-field
                  label="Gallery / Portfolio"
                  [status]="modChecklistStatus(detail, 'gallery images attached') || 'Pending'"
                  [value]="modChecklistStatus(detail, 'gallery images attached') || 'Pending'"
                  [verified]="modIsGalleryVerified(detail)"
                  (toggled)="modToggle('galleryImagesVerified', !modIsGalleryVerified(detail))"
                ></app-verification-field>
                <div class="flag-type-selector" *ngIf="!modIsGalleryVerified(detail)">
                  <span class="flag-type-label">Flag reason</span>
                  <div class="flag-type-btns">
                    <button
                      *ngFor="let opt of GALLERY_FLAG_OPTIONS"
                      type="button"
                      class="flag-type-btn flag-chip--quality"
                      [class.active]="modGetActiveGalleryFlagCode(detail) === opt.code"
                      (click)="modSetGalleryFlagCode(opt.code)"
                      [title]="opt.hint"
                    >{{ opt.label }}</button>
                  </div>
                </div>
              </div>
              <div>
                <app-verification-field
                  label="Location"
                  [status]="modIsLocationVerified(detail) ? 'Verified' : 'Pending'"
                  [value]="modIsLocationVerified(detail) ? 'Verified' : 'Pending'"
                  [verified]="modIsLocationVerified(detail)"
                  (toggled)="modToggle('locationVerified', !modIsLocationVerified(detail))"
                ></app-verification-field>
              </div>
              <div *ngIf="selectedRow()?.userType !== 'Brand'">
                <app-verification-field
                  label="Social Profile & Creator Tier"
                  [status]="modIsCreatorTierVerified(detail) ? 'Verified' : 'Pending'"
                  [value]="modIsCreatorTierVerified(detail) ? 'Verified' : 'Pending'"
                  [verified]="modIsCreatorTierVerified(detail)"
                  (toggled)="modToggle('creatorTierVerified', !modIsCreatorTierVerified(detail))"
                ></app-verification-field>
              </div>
              <div *ngIf="selectedRow()?.userType !== 'Brand'">
                <app-verification-field
                  label="Payment Method"
                  [status]="modIsPaymentVerified(detail) ? 'Verified' : 'Pending'"
                  [value]="modIsPaymentVerified(detail) ? 'Verified' : 'Pending'"
                  [verified]="modIsPaymentVerified(detail)"
                  (toggled)="modToggle('paymentVerified', !modIsPaymentVerified(detail))"
                ></app-verification-field>
              </div>
            </div>
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
    .verify-section {
      border-top: 1px solid #e8edf5;
      padding-top: 1rem;
    }
    .verify-section-title {
      margin: 0 0 0.75rem;
      color: #465468;
      font-size: 0.78rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .flag-type-selector {
      margin-top: 6px;
      display: grid;
      gap: 5px;
    }
    .flag-type-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #8894a8;
    }
    .flag-change-btn {
      border: 0;
      background: transparent;
      color: #0d6efd;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
      text-transform: none;
      letter-spacing: 0;
    }
    .flag-type-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .flag-group-divider {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 3px 0 1px;
    }
    .flag-group-divider span {
      font-size: 0.62rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #bd2d20;
      white-space: nowrap;
    }
    .flag-group-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #ffd8c2;
    }
    .flag-type-btn {
      border: 1.5px solid #e1e6ef;
      border-radius: 999px;
      background: #f8f9fb;
      color: #465468;
      padding: 3px 10px;
      font-size: 0.72rem;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.12s;
    }
    .flag-type-btn.active {
      border-color: currentColor;
      background: transparent;
    }
    .flag-type-btn.flag-chip--quality.active { color: #9b4b00; border-color: #9b4b00; }
    .flag-type-btn.flag-chip--policy.active  { color: #bd2d20; border-color: #bd2d20; }
    .verify-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    .flag-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }
    .flag-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 0.68rem;
      font-weight: 800;
      background: #eef1f6;
      color: #465468;
    }
    .flag-chip--quality {
      background: #fff5e5;
      color: #9b4b00;
    }
    .flag-chip--policy {
      background: #fff0ef;
      color: #bd2d20;
    }
    .flag-chip--warn {
      background: #fffae5;
      color: #7a5900;
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
      .verify-grid {
        grid-template-columns: 1fr;
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

  // ── Verification helpers ──────────────────────────────────────────────────

  modChecklistStatus(data: ProfileVerificationDashboard, label: string): string {
    return String(
      data.checklist?.find((i) => i.label.toLowerCase() === label.toLowerCase())?.status || '',
    );
  }

  private modHasOpenFlag(data: ProfileVerificationDashboard, code: string): boolean {
    return (data.actionRequired || []).some((f) => f.flagCode === code && f.status === 'Open');
  }

  modIsEmailVerified(data: ProfileVerificationDashboard): boolean {
    return this.modChecklistStatus(data, 'email verified') === 'Verified';
  }

  modIsMobileVerified(data: ProfileVerificationDashboard): boolean {
    return this.modChecklistStatus(data, 'mobile verified') === 'Verified';
  }

  modIsPhotoVerified(data: ProfileVerificationDashboard): boolean {
    return this.modChecklistStatus(data, 'profile photo') === 'Verified';
  }

  modIsPhotoPolicyViolation(data: ProfileVerificationDashboard): boolean {
    return this.modHasOpenFlag(data, 'PROFILE_PHOTO_POLICY');
  }

  modIsGalleryVerified(data: ProfileVerificationDashboard): boolean {
    const s = this.modChecklistStatus(data, 'gallery images attached');
    return s === 'Verified' || s === 'Attached';
  }

  modIsLocationVerified(data: ProfileVerificationDashboard): boolean {
    return this.modChecklistStatus(data, 'location') === 'Verified';
  }

  modIsCreatorTierVerified(data: ProfileVerificationDashboard): boolean {
    return this.modChecklistStatus(data, 'social profile & creator tier') === 'Verified';
  }

  modIsPaymentVerified(data: ProfileVerificationDashboard): boolean {
    return this.modChecklistStatus(data, 'payment method verified') === 'Verified';
  }

  private static readonly MOD_FLAG_LABELS: Record<string, { label: string; cls: string }> = {
    PROFILE_PHOTO_QUALITY:       { label: 'Quality Issue',    cls: 'flag-chip--quality' },
    PROFILE_PHOTO_SCREENSHOT:    { label: 'Screenshot',       cls: 'flag-chip--quality' },
    PROFILE_PHOTO_CELEBRITY:     { label: 'Fake/Celebrity',   cls: 'flag-chip--policy'  },
    PROFILE_PHOTO_GROUP:         { label: 'Group Photo',      cls: 'flag-chip--quality' },
    PROFILE_PHOTO_BLURRY:        { label: 'Blurry',           cls: 'flag-chip--quality' },
    PROFILE_PHOTO_LOGO:          { label: 'Logo',             cls: 'flag-chip--quality' },
    PROFILE_PHOTO_LOW_QUALITY:   { label: 'Low Quality',      cls: 'flag-chip--quality' },
    FACE_NOT_VISIBLE:            { label: 'Face Not Visible', cls: 'flag-chip--quality' },
    PROFILE_PHOTO_POLICY:        { label: 'Policy Violation', cls: 'flag-chip--policy'  },
    PROFILE_PHOTO_CONTACT_INFO:  { label: 'Contact Info',     cls: 'flag-chip--policy'  },
    PROFILE_PHOTO_QR_CODE:       { label: 'QR Code',          cls: 'flag-chip--policy'  },
    PORTFOLIO_MISSING:           { label: 'Gallery Missing',  cls: 'flag-chip--warn'    },
    PORTFOLIO_SCREENSHOT:        { label: 'Screenshot',       cls: 'flag-chip--quality' },
    PORTFOLIO_LOW_QUALITY:       { label: 'Low Quality',      cls: 'flag-chip--quality' },
    PORTFOLIO_DUPLICATE:         { label: 'Duplicate',        cls: 'flag-chip--quality' },
    PORTFOLIO_WATERMARK:         { label: 'Watermark',        cls: 'flag-chip--quality' },
  };

  private modFlagBadges(data: ProfileVerificationDashboard, codes: string[]): { label: string; cls: string }[] {
    const openCodes = new Set(
      (data.actionRequired || []).filter((f) => f.status === 'Open').map((f) => f.flagCode),
    );
    const labels = AdminProfileModerationComponent.MOD_FLAG_LABELS;
    return codes.filter((c) => openCodes.has(c) && labels[c]).map((c) => labels[c]);
  }

  modGetPhotoFlags(data: ProfileVerificationDashboard): { label: string; cls: string }[] {
    return this.modFlagBadges(data, [
      'PROFILE_PHOTO_QUALITY', 'PROFILE_PHOTO_SCREENSHOT', 'PROFILE_PHOTO_CELEBRITY',
      'PROFILE_PHOTO_GROUP', 'PROFILE_PHOTO_BLURRY', 'PROFILE_PHOTO_LOGO',
      'PROFILE_PHOTO_LOW_QUALITY', 'FACE_NOT_VISIBLE', 'PROFILE_PHOTO_POLICY',
      'PROFILE_PHOTO_CONTACT_INFO', 'PROFILE_PHOTO_QR_CODE',
    ]);
  }

  modGetGalleryFlags(data: ProfileVerificationDashboard): { label: string; cls: string }[] {
    return this.modFlagBadges(data, [
      'PORTFOLIO_MISSING', 'PORTFOLIO_SCREENSHOT', 'PORTFOLIO_LOW_QUALITY',
      'PORTFOLIO_DUPLICATE', 'PORTFOLIO_WATERMARK',
    ]);
  }

  // ── Flag-type selectors ───────────────────────────────────────────────────

  readonly PHOTO_FLAG_OPTIONS = [
    { code: 'PROFILE_PHOTO_QUALITY',      label: 'Quality Issue',   cls: 'flag-chip--quality', policy: false,
      hint: 'Blurry · Low Quality · Poor Lighting · Cropped Face' },
    { code: 'FACE_NOT_VISIBLE',           label: 'Face Visibility', cls: 'flag-chip--quality', policy: false,
      hint: 'Group Photo · No Face · Covered Face · Sunglasses' },
    { code: 'PROFILE_PHOTO_SCREENSHOT',   label: 'Screenshot',      cls: 'flag-chip--quality', policy: false,
      hint: 'Instagram · Facebook · App UI screenshot' },
    { code: 'PROFILE_PHOTO_CELEBRITY',    label: 'Identity Issue',  cls: 'flag-chip--quality', policy: false,
      hint: 'Fake/Celebrity · Logo · Non-Personal Image' },
    { code: 'PROFILE_PHOTO_CONTACT_INFO', label: 'Contact Info ⚠', cls: 'flag-chip--policy',  policy: true,
      hint: 'Phone number · Email · Social handle in photo' },
    { code: 'PROFILE_PHOTO_QR_CODE',      label: 'QR Code ⚠',      cls: 'flag-chip--policy',  policy: true,
      hint: 'QR code · Booking link in photo' },
    { code: 'PROFILE_PHOTO_POLICY',       label: 'Other Policy ⚠', cls: 'flag-chip--policy',  policy: true,
      hint: 'Other platform guideline violation' },
  ];

  readonly GALLERY_FLAG_OPTIONS = [
    { code: 'PORTFOLIO_LOW_QUALITY', label: 'Quality Issue',     hint: 'Low Quality · Watermark' },
    { code: 'PORTFOLIO_SCREENSHOT',  label: 'Screenshot',        hint: 'Screenshots in gallery' },
    { code: 'PORTFOLIO_DUPLICATE',   label: 'Duplicate Content', hint: 'Duplicate images' },
    { code: 'PORTFOLIO_MISSING',     label: 'Missing Gallery',   hint: 'No valid gallery images' },
  ];

  modGetActivePhotoFlagCode(data: ProfileVerificationDashboard): string {
    const open = new Set((data.actionRequired || []).filter((f) => f.status === 'Open').map((f) => f.flagCode));
    // Map stored flag codes → the category option code used in PHOTO_FLAG_OPTIONS
    const codeToCategory: Record<string, string> = {
      PROFILE_PHOTO_CONTACT_INFO: 'PROFILE_PHOTO_CONTACT_INFO',
      PROFILE_PHOTO_QR_CODE:      'PROFILE_PHOTO_QR_CODE',
      PROFILE_PHOTO_POLICY:       'PROFILE_PHOTO_POLICY',
      PROFILE_PHOTO_CELEBRITY:    'PROFILE_PHOTO_CELEBRITY',
      PROFILE_PHOTO_LOGO:         'PROFILE_PHOTO_CELEBRITY',
      PROFILE_PHOTO_SCREENSHOT:   'PROFILE_PHOTO_SCREENSHOT',
      PROFILE_PHOTO_QUALITY:      'PROFILE_PHOTO_QUALITY',
      PROFILE_PHOTO_BLURRY:       'PROFILE_PHOTO_QUALITY',
      PROFILE_PHOTO_LOW_QUALITY:  'PROFILE_PHOTO_QUALITY',
      PROFILE_PHOTO_GROUP:        'FACE_NOT_VISIBLE',
      FACE_NOT_VISIBLE:           'FACE_NOT_VISIBLE',
    };
    const priority = [
      'PROFILE_PHOTO_CONTACT_INFO', 'PROFILE_PHOTO_QR_CODE', 'PROFILE_PHOTO_POLICY',
      'PROFILE_PHOTO_CELEBRITY', 'PROFILE_PHOTO_LOGO',
      'PROFILE_PHOTO_SCREENSHOT',
      'PROFILE_PHOTO_QUALITY', 'PROFILE_PHOTO_BLURRY', 'PROFILE_PHOTO_LOW_QUALITY',
      'PROFILE_PHOTO_GROUP', 'FACE_NOT_VISIBLE',
    ];
    const found = priority.find((c) => open.has(c));
    return found ? (codeToCategory[found] || found) : '';
  }

  modGetActiveGalleryFlagCode(data: ProfileVerificationDashboard): string {
    const open = new Set((data.actionRequired || []).filter((f) => f.status === 'Open').map((f) => f.flagCode));
    // Map stored codes → category option codes used in GALLERY_FLAG_OPTIONS
    const codeToCategory: Record<string, string> = {
      PORTFOLIO_MISSING:     'PORTFOLIO_MISSING',
      PORTFOLIO_SCREENSHOT:  'PORTFOLIO_SCREENSHOT',
      PORTFOLIO_LOW_QUALITY: 'PORTFOLIO_LOW_QUALITY',
      PORTFOLIO_WATERMARK:   'PORTFOLIO_LOW_QUALITY',
      PORTFOLIO_DUPLICATE:   'PORTFOLIO_DUPLICATE',
    };
    const priority = ['PORTFOLIO_MISSING', 'PORTFOLIO_SCREENSHOT', 'PORTFOLIO_DUPLICATE',
      'PORTFOLIO_LOW_QUALITY', 'PORTFOLIO_WATERMARK'];
    const found = priority.find((c) => open.has(c));
    return found ? (codeToCategory[found] || found) : '';
  }

  modSetPhotoFlagCode(code: string): void {
    const row = this.selectedRow();
    if (!row) return;
    this.api.contactVerification(row.userType, row.userId, { profilePhotoVerified: false, photoFlagCode: code }).subscribe({
      next: () => this.refreshSelected(),
      error: (err) => this.error.set(err?.error?.message || 'Failed'),
    });
  }

  modSetGalleryFlagCode(code: string): void {
    const row = this.selectedRow();
    if (!row) return;
    this.api.contactVerification(row.userType, row.userId, { galleryImagesVerified: false, galleryFlagCode: code }).subscribe({
      next: () => this.refreshSelected(),
      error: (err) => this.error.set(err?.error?.message || 'Failed'),
    });
  }

  // ── Verification toggles ──────────────────────────────────────────────────

  modToggle(field: string, value: boolean): void {
    const row = this.selectedRow();
    if (!row) return;
    const label = field === 'isEmailVerified' ? 'email'
      : field === 'isMobileVerified' ? 'mobile'
      : field === 'profilePhotoVerified' ? 'profile photo'
      : field === 'photoPolicy' ? (value ? 'flag photo policy violation' : 'clear photo policy violation')
      : field === 'galleryImagesVerified' ? 'gallery images'
      : field === 'locationVerified' ? 'location'
      : field === 'creatorTierVerified' ? 'creator tier'
      : field === 'paymentVerified' ? 'payment method'
      : field;
    if (!confirm(`Mark ${label} as ${value ? 'verified' : 'pending'}?`)) return;
    this.api.contactVerification(row.userType, row.userId, { [field]: value }).subscribe({
      next: () => this.refreshSelected(),
      error: (err) => this.error.set(err?.error?.message || 'Verification update failed.'),
    });
  }
}
