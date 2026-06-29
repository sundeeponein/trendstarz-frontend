import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProfileVerificationDashboard } from '../../services/profile-verification.service';

const PHOTO_FLAG_CODES = new Set([
  'PROFILE_PHOTO_QUALITY', 'PROFILE_PHOTO_PENDING_REVIEW', 'PROFILE_PHOTO_MISSING',
  'PROFILE_PHOTO_SCREENSHOT', 'PROFILE_PHOTO_CELEBRITY', 'PROFILE_PHOTO_GROUP',
  'PROFILE_PHOTO_BLURRY', 'PROFILE_PHOTO_LOGO', 'PROFILE_PHOTO_LOW_QUALITY',
  'FACE_NOT_VISIBLE', 'PROFILE_PHOTO_POLICY',
  'PROFILE_PHOTO_CONTACT_INFO', 'PROFILE_PHOTO_QR_CODE',
]);

const PHOTO_SAFETY_CODES = new Set([
  'PROFILE_PHOTO_POLICY', 'PROFILE_PHOTO_CELEBRITY',
  'PROFILE_PHOTO_CONTACT_INFO', 'PROFILE_PHOTO_QR_CODE',
]);

const GALLERY_FLAG_CODES = new Set([
  'PORTFOLIO_MISSING', 'PORTFOLIO_SCREENSHOT', 'PORTFOLIO_LOW_QUALITY',
  'PORTFOLIO_DUPLICATE', 'PORTFOLIO_WATERMARK',
]);

@Component({
  selector: 'app-profile-review-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="review-summary" *ngIf="detail || loading">
      <div class="summary-loading" *ngIf="loading">
        <span class="spinner-border spinner-border-sm text-warning" role="status"></span>
        <span>Loading review...</span>
      </div>

      <ng-container *ngIf="!loading && detail as data">
        <div class="summary-grid">
          <div>
            <span>Profile</span>
            <strong>{{ data.profileCompletion || 0 }}%</strong>
          </div>
          <div>
            <span>Campaign</span>
            <strong [ngClass]="campaignStatusClass(data)">
              {{ campaignStatusLabel(data) }}
            </strong>
          </div>
        </div>
        <button type="button" class="summary-link" (click)="open = true">
          View review
        </button>
      </ng-container>
    </div>

    <div class="review-modal-backdrop" *ngIf="open" (click)="open = false">
      <div class="review-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <div class="review-modal-header">
          <div>
            <p>Profile Review</p>
            <h3>{{ detail?.displayName || 'Profile' }}</h3>
          </div>
          <button type="button" class="close-btn" aria-label="Close" (click)="open = false">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="review-modal-body">
          <div class="simple-review" *ngIf="detail as data">

            <!-- Progress bar -->
            <div class="simple-card">
              <span>Profile completion</span>
              <strong>{{ data.profileCompletion || 0 }}%</strong>
              <div class="meter"><i [style.width.%]="data.profileCompletion || 0"></i></div>
            </div>

            <!-- Status row -->
            <div class="row g-2">
              <div class="col-12 col-md-6">
                <div class="simple-card h-100" [ngClass]="'card-' + campaignCardVariant(data)">
                  <span>Campaign status</span>
                  <strong [ngClass]="campaignStatusClass(data)">{{ campaignStatusLabel(data) }}</strong>
                  <ng-container [ngSwitch]="campaignCardVariant(data)">
                    <p *ngSwitchCase="'ok'">
                      Your profile is visible and you can receive campaign invitations.
                    </p>
                    <p *ngSwitchCase="'update'">
                      <ng-container *ngIf="data.campaignEligibility.blockers.length; else genericUpdateMsg">
                        Your profile is currently hidden from creator discovery: {{ data.campaignEligibility.blockers.join('; ') }}.
                      </ng-container>
                      <ng-template #genericUpdateMsg>Your profile is currently hidden from creator discovery until your profile is updated.</ng-template>
                    </p>
                    <p *ngSwitchCase="'restricted'">
                      <ng-container *ngIf="data.campaignEligibility.blockers.length; else genericRestrictedMsg">
                        {{ data.campaignEligibility.blockers.join('; ') }}.
                      </ng-container>
                      <ng-template #genericRestrictedMsg>Update your profile to restore campaign visibility.</ng-template>
                    </p>
                  </ng-container>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <div class="simple-card h-100">
                  <span>Review status</span>
                  <strong [ngClass]="reviewStatusClass(data)">{{ reviewStatusLabel(data) }}</strong>
                  <ng-container [ngSwitch]="sectionCount(data)">
                    <p *ngSwitchCase="0">No profile sections need attention.</p>
                    <p *ngSwitchCase="1">1 profile section needs attention.</p>
                    <p *ngSwitchDefault>{{ sectionCount(data) }} profile sections need attention.</p>
                  </ng-container>
                </div>
              </div>
            </div>

            <!-- Verified items -->
            <div class="simple-card" *ngIf="getVerifiedItems(data).length">
              <span>Verified</span>
              <ul class="status-list ok">
                <li *ngFor="let item of getVerifiedItems(data)">
                  <i class="bi bi-check-circle-fill"></i>{{ item }}
                </li>
              </ul>
            </div>

            <!-- Profile photo attention card -->
            <div class="attention-card" *ngIf="hasPhotoFlags(data)">
              <div class="attention-card-header">
                <i class="bi bi-exclamation-triangle-fill"></i>
                <strong>Profile Photo Requires Update</strong>
              </div>
              <p *ngIf="hasSafetyFlags(data)" class="attention-desc">
                Your profile photo violates TrendStarz safety guidelines.
              </p>
              <p *ngIf="!hasSafetyFlags(data)" class="attention-desc">
                Your profile photo does not meet TrendStarz guidelines.
              </p>
              <p class="attention-sub">Please upload a clear photo:</p>
              <ul class="attention-list">
                <li>Showing your face clearly</li>
                <li>Without screenshots or interface elements</li>
                <li>Without contact information, QR codes, or promotional content</li>
                <li>Without logos or celebrity photos</li>
              </ul>
              <div class="attention-impact">
                <span class="impact-label">Impact</span>
                <div class="impact-items">
                  <span><i class="bi bi-eye-slash"></i> Hidden from public search</span>
                  <span><i class="bi bi-eye-slash"></i> Hidden from campaign discovery</span>
                  <span *ngIf="hasSafetyFlags(data)"><i class="bi bi-lock"></i> Campaign invitations paused</span>
                </div>
              </div>
              <a *ngIf="profileRoute" [routerLink]="profileRoute" class="attention-btn" (click)="open = false">
                Update Profile Photo
              </a>
            </div>

            <!-- Gallery attention card -->
            <div class="attention-card gallery" *ngIf="hasGalleryFlags(data)">
              <div class="attention-card-header">
                <i class="bi bi-exclamation-triangle-fill"></i>
                <strong>Gallery Images Require Update</strong>
              </div>
              <p class="attention-desc">
                Some gallery images do not meet TrendStarz guidelines.
              </p>
              <p class="attention-sub">Please remove or replace:</p>
              <ul class="attention-list">
                <li *ngIf="hasFlag(data, 'PORTFOLIO_SCREENSHOT')">Screenshots</li>
                <li *ngIf="hasFlag(data, 'PORTFOLIO_DUPLICATE')">Duplicate images</li>
                <li *ngIf="hasFlag(data, 'PORTFOLIO_WATERMARK')">Watermarked images</li>
                <li *ngIf="hasFlag(data, 'PORTFOLIO_LOW_QUALITY')">Low-quality images</li>
                <li *ngIf="hasFlag(data, 'PORTFOLIO_MISSING')">Add at least 3 portfolio images</li>
              </ul>
              <div class="attention-impact">
                <span class="impact-label">Impact</span>
                <div class="impact-items">
                  <span><i class="bi bi-images"></i> Gallery section may be hidden</span>
                  <span class="ok"><i class="bi bi-check-circle"></i> Campaign participation not affected</span>
                </div>
              </div>
              <a *ngIf="profileRoute" [routerLink]="profileRoute" class="attention-btn gallery-btn" (click)="open = false">
                Update Gallery
              </a>
            </div>

            <!-- All clear -->
            <div class="all-clear" *ngIf="!hasPhotoFlags(data) && !hasGalleryFlags(data)">
              <i class="bi bi-check-circle-fill"></i>
              <span>No profile sections need attention.</span>
            </div>

          </div>
        </div>

        <div class="review-modal-actions" *ngIf="profileRoute">
          <a [routerLink]="profileRoute" (click)="open = false">
            <i class="bi bi-person-gear"></i>
            Edit profile
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .review-summary {
      margin-top: 0.65rem;
      display: grid;
      gap: 0.55rem;
    }
    .summary-loading {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      color: #64748b;
      font-weight: 800;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
    }
    .summary-grid > div {
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(215, 222, 234, 0.8);
      padding: 0.45rem 0.55rem;
      display: grid;
      gap: 0.05rem;
    }
    .summary-grid span {
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    .summary-grid strong {
      color: #198754;
      font-size: 0.95rem;
      line-height: 1.15;
    }
    .summary-grid strong.status-restricted { color: #bd2d20; }
    .summary-grid strong.status-update { color: #9b4b00; }
    .summary-link {
      justify-self: start;
      border: 0;
      background: transparent;
      color: #0d6efd;
      padding: 0;
      font-weight: 900;
      text-decoration: underline;
    }
    /* Modal */
    .review-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1080;
      background: rgba(7, 12, 22, 0.6);
      display: grid;
      place-items: center;
      padding: 1rem;
    }
    .review-modal {
      width: min(680px, 100%);
      max-height: min(88vh, 900px);
      overflow: hidden;
      background: #fff;
      border-radius: 14px;
      border: 1px solid #d7deea;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
    }
    .review-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-shrink: 0;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #e8edf5;
    }
    .review-modal-header p {
      margin: 0 0 0.15rem;
      color: #657082;
      font-size: 0.75rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .review-modal-header h3 {
      margin: 0;
      color: #16162f;
      font-weight: 900;
      font-size: 1.1rem;
    }
    .close-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid #d7deea;
      background: #fff;
      color: #16162f;
      flex-shrink: 0;
    }
    .review-modal-body {
      min-height: 0;
      overflow-y: auto;
      padding: 1.25rem;
    }
    .review-modal-actions {
      display: flex;
      justify-content: flex-end;
      flex-shrink: 0;
      padding: 1rem 1.25rem;
      border-top: 1px solid #e8edf5;
      background: #fff;
    }
    .review-modal-actions a {
      border: 1px solid #d7deea;
      border-radius: 9px;
      background: #fff;
      color: #16162f;
      padding: 0.55rem 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-weight: 800;
      text-decoration: none;
    }
    /* Inner layout */
    .simple-review {
      display: grid;
      gap: 0.85rem;
    }
    .simple-card {
      border: 1px solid #e1e6ef;
      border-radius: 10px;
      padding: 0.85rem 1rem;
      background: #fbfcfe;
      display: grid;
      gap: 0.3rem;
    }
    .simple-card span {
      color: #657082;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .simple-card strong {
      color: #198754;
      font-size: 1.15rem;
      line-height: 1.2;
    }
    .simple-card strong.status-restricted { color: #bd2d20; }
    .simple-card strong.status-update { color: #9b4b00; }
    .simple-card strong.status-review { color: #6b48d1; }
    .simple-card p { margin: 0; color: #465468; font-size: 0.88rem; }
    .card-ok { background: #f1fbf5; border-color: #bdebcf; }
    .card-update { background: #fffbf0; border-color: #ffd89b; }
    .card-restricted { background: #fff8f4; border-color: #ffd8c2; }
    .meter {
      height: 8px;
      background: #eef1f6;
      border-radius: 999px;
      overflow: hidden;
    }
    .meter i {
      display: block;
      height: 100%;
      background: #2da64a;
      border-radius: inherit;
    }
    .status-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
    }
    .status-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.45rem;
      color: #465468;
      font-size: 0.88rem;
      font-weight: 700;
    }
    .status-list i { color: #e8580c; margin-top: 0.1rem; font-size: 0.9rem; }
    .status-list.ok i { color: #2da64a; }
    /* Attention cards */
    .attention-card {
      border: 1.5px solid #ffd8c2;
      border-radius: 12px;
      padding: 1.1rem 1.15rem;
      background: #fff8f4;
      display: grid;
      gap: 0.6rem;
    }
    .attention-card.gallery {
      border-color: #ffd89b;
      background: #fffbf0;
    }
    .attention-card-header {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }
    .attention-card-header i {
      color: #e8580c;
      font-size: 1rem;
    }
    .attention-card.gallery .attention-card-header i { color: #9b4b00; }
    .attention-card-header strong {
      color: #16162f;
      font-size: 0.98rem;
      font-weight: 900;
    }
    .attention-desc {
      margin: 0;
      color: #465468;
      font-size: 0.87rem;
    }
    .attention-sub {
      margin: 0;
      color: #465468;
      font-size: 0.85rem;
      font-weight: 800;
    }
    .attention-list {
      margin: 0;
      padding: 0 0 0 1.1rem;
      display: grid;
      gap: 0.28rem;
    }
    .attention-list li {
      color: #465468;
      font-size: 0.87rem;
    }
    .attention-impact {
      display: grid;
      gap: 0.35rem;
      padding: 0.65rem 0.75rem;
      background: rgba(0,0,0,0.03);
      border-radius: 8px;
    }
    .impact-label {
      color: #657082;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .impact-items {
      display: grid;
      gap: 0.3rem;
    }
    .impact-items span {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: #bd2d20;
      font-size: 0.84rem;
      font-weight: 700;
    }
    .impact-items span.ok { color: #198754; }
    .impact-items i { font-size: 0.85rem; }
    .attention-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 1rem;
      border-radius: 9px;
      background: #e8580c;
      color: #fff;
      font-weight: 800;
      font-size: 0.9rem;
      text-decoration: none;
      border: none;
      justify-self: start;
    }
    .attention-btn.gallery-btn { background: #9b4b00; }
    .all-clear {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      background: #f1fbf5;
      border: 1px solid #bdebcf;
      color: #198754;
      font-weight: 800;
    }
    .all-clear i { font-size: 1.1rem; }
  `],
})
export class ProfileReviewSummaryComponent implements OnChanges {
  @Input() detail: ProfileVerificationDashboard | null = null;
  @Input() loading = false;
  @Input() profileRoute = '';
  @Input() autoOpen = false;

  open = false;
  private autoOpened = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.autoOpen &&
      !this.autoOpened &&
      changes['detail'] &&
      this.detail &&
      (this.hasPhotoFlags(this.detail) || this.hasGalleryFlags(this.detail))
    ) {
      this.open = true;
      this.autoOpened = true;
    }
  }

  // Reads from data.flags (the full open-flag list), not data.actionRequired —
  // the backend deliberately excludes "score-only" codes like PORTFOLIO_MISSING
  // from actionRequired so they don't clutter generic admin/action queues, but
  // the gallery attention-card below still needs to know about them so a
  // photographer's missing-portfolio gap gets the same detailed treatment an
  // influencer's photo issue does, instead of just a one-line status text.
  private openFlagCodes(data: ProfileVerificationDashboard): Set<string> {
    return new Set(
      (data.flags || [])
        .filter((f) => f.status === 'Open')
        .map((f) => String(f.flagCode || '').toUpperCase()),
    );
  }

  hasPhotoFlags(data: ProfileVerificationDashboard): boolean {
    const open = this.openFlagCodes(data);
    return Array.from(open).some((c) => PHOTO_FLAG_CODES.has(c));
  }

  hasGalleryFlags(data: ProfileVerificationDashboard): boolean {
    const open = this.openFlagCodes(data);
    return Array.from(open).some((c) => GALLERY_FLAG_CODES.has(c));
  }

  hasSafetyFlags(data: ProfileVerificationDashboard): boolean {
    const open = this.openFlagCodes(data);
    return Array.from(open).some((c) => PHOTO_SAFETY_CODES.has(c));
  }

  hasFlag(data: ProfileVerificationDashboard, code: string): boolean {
    return this.openFlagCodes(data).has(code.toUpperCase());
  }

  sectionCount(data: ProfileVerificationDashboard): number {
    return (this.hasPhotoFlags(data) ? 1 : 0) + (this.hasGalleryFlags(data) ? 1 : 0);
  }

  campaignStatusLabel(data: ProfileVerificationDashboard): string {
    switch (data.campaignStatus) {
      case 'eligible': return 'Eligible';
      case 'profile_update_required': return 'Profile Update Required';
      case 'restricted': return 'Restricted';
      default: return data.campaignEligibility?.eligible ? 'Eligible' : 'Action Required';
    }
  }

  campaignStatusClass(data: ProfileVerificationDashboard): string {
    switch (data.campaignStatus) {
      case 'eligible': return '';
      case 'profile_update_required': return 'status-update';
      case 'restricted': return 'status-restricted';
      default: return data.campaignEligibility?.eligible ? '' : 'status-restricted';
    }
  }

  campaignCardVariant(data: ProfileVerificationDashboard): string {
    switch (data.campaignStatus) {
      case 'eligible': return 'ok';
      case 'profile_update_required': return 'update';
      case 'restricted': return 'restricted';
      default: return data.campaignEligibility?.eligible ? 'ok' : 'restricted';
    }
  }

  reviewStatusLabel(data: ProfileVerificationDashboard): string {
    if (data.isTrendstarzVerified) return 'Approved';
    if (data.campaignStatus === 'restricted') return 'Restricted';
    if (data.profileTier === 'Needs Attention' || this.sectionCount(data) > 0) return 'Action Required';
    if (data.profileTier === 'Under Review') return 'Under Review';
    return data.profileTier || 'Under Review';
  }

  reviewStatusClass(data: ProfileVerificationDashboard): string {
    const label = this.reviewStatusLabel(data);
    if (label === 'Approved') return '';
    if (label === 'Under Review') return 'status-review';
    if (label === 'Restricted') return 'status-restricted';
    return 'status-update';
  }

  getVerifiedItems(data: ProfileVerificationDashboard): string[] {
    return (data.checklist || [])
      .filter((item) => item.status === 'Verified')
      .map((item) => item.label);
  }
}
