import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  ModerationRow,
  ProfileVerificationDashboard,
  ProfileVerificationService,
} from '../../../services/profile-verification.service';
import { ProfileReviewPanelComponent } from '../../../shared/profile-verification/profile-review-panel.component';
import { FlagManagementDialogComponent } from './flag-management-dialog.component';
import { VerificationFieldComponent } from '../../../shared/components/verification-field/verification-field.component';
import { ProfileVisibilitySelectorComponent } from '../../../shared/components/profile-visibility-selector/profile-visibility-selector.component';
import { HomepageFeatureToggleComponent } from '../../../shared/components/homepage-feature-toggle/homepage-feature-toggle.component';
import { copyTextToClipboard } from '../../../shared/referral-link.util';

@Component({
  selector: 'app-admin-profile-moderation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProfileReviewPanelComponent,
    FlagManagementDialogComponent,
    VerificationFieldComponent,
    ProfileVisibilitySelectorComponent,
    HomepageFeatureToggleComponent,
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
                <div class="whatsapp-reminder-actions" *ngIf="!modIsMobileVerified(detail)">
                  <button
                    type="button"
                    class="whatsapp-reminder-btn"
                    [disabled]="mobileReminderBusy()"
                    (click)="sendMobileOtpReminder()"
                  >
                    <i class="bi bi-whatsapp"></i>
                    {{ mobileReminderBusy() ? 'Sending…' : 'Send OTP Reminder' }}
                  </button>
                  <button
                    type="button"
                    class="whatsapp-reminder-btn whatsapp-reminder-btn--secondary"
                    [disabled]="mobileReminderBusy()"
                    (click)="sendMobileVerificationReminder()"
                  >
                    <i class="bi bi-whatsapp"></i>
                    {{ mobileReminderBusy() ? 'Sending…' : 'Request Manual Call' }}
                  </button>
                </div>
                <div class="text-muted mt-1" style="font-size:0.78rem;" *ngIf="mobileReminderResult() as result">
                  {{ result }}
                </div>
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

          <div class="verify-section">
            <h6 class="verify-section-title">Profile Visibility & Discovery</h6>
            <div class="visibility-unset-banner" *ngIf="!detail.profileVisibilityIsSet">
              <i class="bi bi-exclamation-triangle-fill"></i>
              This user hasn't been asked yet — ask "Who can view your TrendStarZ profile?" during this call and set it below.
            </div>

            <div class="discovery-card" [ngClass]="modDiscoveryStatus(detail).tone">
              <div class="discovery-card__header">
                <span class="status-pill" [ngClass]="modDiscoveryStatus(detail).tone">{{ modDiscoveryStatus(detail).label }}</span>
                <span class="status-caption">{{ modDiscoveryStatus(detail).caption }}</span>
              </div>
              <p class="discovery-card__copy">{{ modDiscoveryStatus(detail).explanation }}</p>
              <div class="discovery-card__actions">
                <button type="button" class="mini-btn mini-btn--primary" (click)="setVisibility('PUBLIC')">Set Public</button>
                <button type="button" class="mini-btn" (click)="setVisibility('MEMBERS_ONLY')">Members Only</button>
                <button type="button" class="mini-btn mini-btn--danger" (click)="setVisibility('PRIVATE')">Make Private</button>
              </div>
              <div class="discovery-card__actions">
                <button type="button" class="mini-btn" (click)="setHomepageFeature(true)">Enable Homepage Feature</button>
                <button type="button" class="mini-btn mini-btn--ghost" (click)="setHomepageFeature(false)">Disable Feature</button>
              </div>
              <div class="discovery-card__actions">
                <button type="button" class="mini-btn" (click)="grantPremium('1m')" [disabled]="premiumBusy()">Grant 1M Premium</button>
                <button type="button" class="mini-btn" (click)="grantPremium('3m')" [disabled]="premiumBusy()">Grant 3M Premium</button>
                <button type="button" class="mini-btn" (click)="grantPremium('1y')" [disabled]="premiumBusy()">Grant 1Y Premium</button>
              </div>
              <div class="discovery-card__actions" *ngIf="premiumMessage()">
                <span class="status-caption">{{ premiumMessage() }}</span>
              </div>
            </div>

            <div class="discovery-card discovery-card--compact mt-2">
              <div class="discovery-card__header">
                <strong>Suggested next step</strong>
              </div>
              <p class="discovery-card__copy">{{ modDiscoveryStatus(detail).recommendation }}</p>
              <ul class="checklist-list">
                <li *ngFor="let item of modDiscoveryChecklist(detail)">{{ item }}</li>
              </ul>
            </div>

            <div class="discovery-link-row">
              <button type="button" class="mini-btn" (click)="openPublicProfile()">Open public profile</button>
              <button type="button" class="mini-btn" (click)="copyLink('profile')">{{ linkCopyBusy() === 'profile' ? 'Copied' : 'Copy profile link' }}</button>
              <button type="button" class="mini-btn" (click)="copyLink('referral')">{{ linkCopyBusy() === 'referral' ? 'Copied' : 'Copy referral link' }}</button>
              <a class="mini-btn mini-btn--link" [href]="mailtoLink(detail)" *ngIf="selectedRow()?.email">Email</a>
              <a class="mini-btn mini-btn--link" [href]="callLink(detail)" *ngIf="detail.phoneNumber">Call</a>
              <a class="mini-btn mini-btn--link" [href]="whatsappLink(detail)" target="_blank" rel="noopener" *ngIf="detail.phoneNumber">WhatsApp</a>
            </div>

            <app-profile-visibility-selector
              class="mt-3 d-block"
              [value]="detail.profileVisibility"
              [disabled]="visibilityBusy()"
              (valueChange)="modUpdateVisibility($event)">
            </app-profile-visibility-selector>

            <app-homepage-feature-toggle
              class="mt-3 d-block"
              [checked]="detail.featuredInMarketing"
              [disabled]="visibilityBusy() || detail.profileVisibility !== 'PUBLIC'"
              [isPremium]="true"
              (checkedChange)="modUpdateFeatured($event)">
            </app-homepage-feature-toggle>
            <p class="text-muted mt-1" style="font-size:0.78rem;" *ngIf="!detail.homepageEligibility.isPremium">
              Note: this profile is not currently Premium — the toggle above is an admin override; self-service users would see an upgrade prompt instead.
            </p>
          </div>

          <div class="verify-section">
            <h6 class="verify-section-title">Eligibility Status</h6>
            <table class="eligibility-table">
              <tbody>
                <tr>
                  <td>Email Verified</td>
                  <td>{{ detail.homepageEligibility.emailVerified ? '✅' : '❌' }}</td>
                </tr>
                <tr>
                  <td>Mobile Verified</td>
                  <td>{{ detail.homepageEligibility.mobileVerified ? '✅' : '❌' }}</td>
                </tr>
                <tr>
                  <td>Profile Photo Approved</td>
                  <td>{{ detail.homepageEligibility.profilePhotoApproved ? '✅' : '❌' }}</td>
                </tr>
                <tr>
                  <td>Profile Approved</td>
                  <td>{{ detail.homepageEligibility.profileApproved ? '✅' : '❌' }}</td>
                </tr>
                <tr>
                  <td>Premium</td>
                  <td>{{ detail.homepageEligibility.isPremium ? '✅' : '❌' }}</td>
                </tr>
                <tr>
                  <td>Homepage Consent</td>
                  <td>{{ detail.homepageEligibility.homepageConsent ? '✅' : '❌' }}</td>
                </tr>
              </tbody>
            </table>
            <div class="eligibility-result" [class.eligible]="detail.homepageEligibility.eligibleForHomepage">
              <strong>Eligible for Homepage Hero: {{ detail.homepageEligibility.eligibleForHomepage ? '✅ Yes' : '❌ No' }}</strong>
              <ul *ngIf="!detail.homepageEligibility.eligibleForHomepage" class="eligibility-reasons">
                <li *ngFor="let reason of detail.homepageEligibility.reasons">{{ reason }}</li>
              </ul>
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
    .eligibility-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.84rem;
      margin-bottom: 0.75rem;
    }
    .eligibility-table td {
      padding: 0.4rem 0.25rem;
      border-bottom: 1px solid #eef1f6;
    }
    .eligibility-table td:last-child {
      text-align: right;
      width: 2rem;
    }
    .eligibility-result {
      border-radius: 8px;
      padding: 0.75rem;
      background: #fdeded;
      border: 1px solid #f3c9c9;
      color: #b42318;
      font-size: 0.86rem;
    }
    .eligibility-result.eligible {
      background: #eefaf1;
      border-color: #bfe6c9;
      color: #1a7f3c;
    }
    .eligibility-reasons {
      margin: 0.5rem 0 0;
      padding-left: 1.1rem;
      font-weight: 400;
    }
    .visibility-unset-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
      font-size: 0.8rem;
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      margin-bottom: 0.75rem;
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
    .whatsapp-reminder-actions {
      margin-top: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .whatsapp-reminder-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border: 1px solid #25d366;
      background: #f0fdf6;
      color: #128c4a;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
    }
    .whatsapp-reminder-btn--secondary {
      border-color: #d1d5db;
      background: #f7f8fb;
      color: #465468;
    }
    .discovery-card {
      border: 1px solid #e8edf5;
      border-radius: 12px;
      padding: 0.8rem 0.9rem;
      background: #fbfcfe;
      display: grid;
      gap: 0.65rem;
    }
    .discovery-card--compact {
      background: #fff;
    }
    .discovery-card.discoverable {
      border-color: #bfe6c9;
      background: #f4fcf6;
    }
    .discovery-card.limited {
      border-color: #ffd89b;
      background: #fff8e8;
    }
    .discovery-card.hidden {
      border-color: #ffc9bf;
      background: #fff2ef;
    }
    .discovery-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.25rem 0.6rem;
      font-size: 0.74rem;
      font-weight: 900;
      color: #16162f;
      background: #e8edf5;
    }
    .status-pill.discoverable {
      background: #e4f8ea;
      color: #1b7f3d;
    }
    .status-pill.limited {
      background: #fff0c9;
      color: #9b4b00;
    }
    .status-pill.hidden {
      background: #ffe0da;
      color: #b42318;
    }
    .status-caption {
      color: #657082;
      font-size: 0.78rem;
      font-weight: 700;
    }
    .discovery-card__copy {
      margin: 0;
      color: #465468;
      font-size: 0.86rem;
      line-height: 1.45;
    }
    .discovery-card__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    .mini-btn {
      border: 1px solid #d7deea;
      border-radius: 999px;
      background: #fff;
      color: #16162f;
      padding: 0.35rem 0.7rem;
      font-size: 0.75rem;
      font-weight: 800;
      cursor: pointer;
    }
    .mini-btn--primary {
      background: #e8580c;
      border-color: #e8580c;
      color: #fff;
    }
    .mini-btn--danger {
      background: #fff0ef;
      border-color: #ffc9bf;
      color: #bd2d20;
    }
    .mini-btn--ghost {
      background: #f7f8fb;
    }
    .mini-btn--link {
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .checklist-list {
      margin: 0;
      padding-left: 1rem;
      color: #465468;
      font-size: 0.82rem;
      display: grid;
      gap: 0.25rem;
    }
    .discovery-link-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.55rem;
    }
    .whatsapp-reminder-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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

  constructor(
    private api: ProfileVerificationService,
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

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

  // ── Visibility / Homepage Feature (admin override) ─────────────────────────

  visibilityBusy = signal(false);
  premiumBusy = signal(false);
  premiumMessage = signal<string | null>(null);
  linkCopyBusy = signal<'profile' | 'referral' | null>(null);

  modUpdateVisibility(profileVisibility: string): void {
    const row = this.selectedRow();
    if (!row || this.visibilityBusy()) return;
    this.visibilityBusy.set(true);
    this.api.updateVisibility(row.userType, row.userId, { profileVisibility }).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.visibilityBusy.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Visibility update failed.');
        this.visibilityBusy.set(false);
      },
    });
  }

  modUpdateFeatured(featuredInMarketing: boolean): void {
    const row = this.selectedRow();
    if (!row || this.visibilityBusy()) return;
    this.visibilityBusy.set(true);
    this.api.updateVisibility(row.userType, row.userId, { featuredInMarketing }).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.visibilityBusy.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Homepage Feature update failed.');
        this.visibilityBusy.set(false);
      },
    });
  }

  modDiscoveryStatus(detail: ProfileVerificationDashboard): {
    label: string;
    tone: 'discoverable' | 'limited' | 'hidden';
    caption: string;
    explanation: string;
    recommendation: string;
  } {
    const visibility = detail?.profileVisibility || 'PUBLIC';
    const eligibility = detail?.homepageEligibility;
    const homepageEligible = !!eligibility?.eligibleForHomepage;
    if (visibility === 'PUBLIC' && homepageEligible) {
      return {
        label: 'Discoverable',
        tone: 'discoverable',
        caption: 'Visible to guests and logged-in users, and eligible for homepage feature.',
        explanation: 'This profile is public, premium-ready, and approved for public homepage placement.',
        recommendation: 'Keep the current setup and explain that the profile is now discoverable and eligible for homepage visibility.',
      };
    }
    if (visibility === 'MEMBERS_ONLY') {
      return {
        label: 'Members Only',
        tone: 'limited',
        caption: 'Visible after login, but hidden from public discovery.',
        explanation: 'This profile is not publicly discoverable, so it cannot appear in the public homepage or welcome marketing sections.',
        recommendation: 'Set visibility to Public if the user wants public discoverability, or explain that they can stay members-only until they are ready.',
      };
    }
    if (visibility === 'PRIVATE') {
      return {
        label: 'Hidden',
        tone: 'hidden',
        caption: 'Private profile — invisible to everyone except the owner.',
        explanation: 'This profile is private and should not be featured or discovered publicly.',
        recommendation: 'Set visibility to Public when the user wants discoverability, or keep it private while discussing the onboarding intent.',
      };
    }
    return {
      label: 'Needs setup',
      tone: 'limited',
      caption: 'Visibility is not clearly set yet.',
      explanation: 'The profile visibility choice has not yet been confirmed for this account.',
      recommendation: 'Ask the user which visibility they want and set it before discussing homepage placement.',
    };
  }

  modDiscoveryChecklist(detail: ProfileVerificationDashboard): string[] {
    const eligibility = detail?.homepageEligibility;
    const items: string[] = [];
    if (!detail?.profileVisibilityIsSet) {
      items.push('Confirm the user’s profile visibility choice during the onboarding call.');
    }
    if (!eligibility?.emailVerified) {
      items.push('Verify email and ask the user to complete the confirmation step.');
    }
    if (!eligibility?.mobileVerified) {
      items.push('Complete mobile verification so the profile can be trusted in public discovery.');
    }
    if (!eligibility?.profilePhotoApproved) {
      items.push('Approve or replace the profile photo so it can be shown publicly.');
    }
    if (!eligibility?.profileApproved) {
      items.push('Approve the profile from moderation before enabling homepage discovery.');
    }
    if (!eligibility?.isPremium) {
      items.push('Upgrade the account to Premium if the user wants homepage feature eligibility.');
    }
    if (!eligibility?.homepageConsent) {
      items.push('Turn on homepage consent so the profile can be eligible for featured placement.');
    }
    if (detail?.profileVisibility !== 'PUBLIC') {
      items.push('Set visibility to Public if the user should be discoverable by guests and logged-in users.');
    }
    return items.length ? items : ['The profile already looks ready for public discovery and homepage placement.'];
  }

  setVisibility(visibility: 'PUBLIC' | 'MEMBERS_ONLY' | 'PRIVATE'): void {
    this.modUpdateVisibility(visibility);
  }

  setHomepageFeature(enabled: boolean): void {
    this.modUpdateFeatured(enabled);
  }

  grantPremium(duration: '1m' | '3m' | '1y'): void {
    const row = this.selectedRow();
    if (!row || this.premiumBusy()) return;
    this.premiumBusy.set(true);
    this.premiumMessage.set(null);
    this.http.patch(`${this.apiBaseUrl}/users/${row.userId}/premium`, {
      isPremium: true,
      premiumDuration: duration,
      type: this.mapUserTypeToApi(row.userType),
    }).subscribe({
      next: () => {
        this.premiumBusy.set(false);
        this.premiumMessage.set(`Premium granted for ${duration}.`);
        this.refreshSelected();
      },
      error: (err) => {
        this.premiumBusy.set(false);
        this.premiumMessage.set(err?.error?.message || 'Failed to grant premium.');
      },
    });
  }

  private mapUserTypeToApi(userType: string): 'influencer' | 'brand' | 'photographer' {
    if (userType === 'Brand') return 'brand';
    if (userType === 'Photographer') return 'photographer';
    return 'influencer';
  }

  openPublicProfile(): void {
    const url = this.selectedDetail()?.publicProfileUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  copyLink(kind: 'profile' | 'referral'): void {
    const detail = this.selectedDetail();
    const value = kind === 'profile' ? detail?.publicProfileUrl : detail?.referralLink;
    if (!value) return;
    copyTextToClipboard(value);
    this.linkCopyBusy.set(kind);
    setTimeout(() => this.linkCopyBusy.set(null), 1800);
  }

  mailtoLink(detail: ProfileVerificationDashboard): string {
    const email = this.selectedRow()?.email || detail?.displayName || '';
    return `mailto:${email}`;
  }

  callLink(detail: ProfileVerificationDashboard): string {
    const phone = detail?.phoneNumber || '';
    return phone ? `tel:${phone}` : '#';
  }

  whatsappLink(detail: ProfileVerificationDashboard): string {
    const phone = detail?.phoneNumber || '';
    if (!phone) return '#';
    const digits = String(phone).replace(/[^0-9]/g, '');
    return digits ? `https://wa.me/${digits}` : '#';
  }

  private readonly apiBaseUrl = environment.apiBaseUrl || '/api';

  // ── Mobile verification WhatsApp reminder ───────────────────────────────

  mobileReminderBusy = signal(false);
  mobileReminderResult = signal<string | null>(null);

  sendMobileOtpReminder(): void {
    const row = this.selectedRow();
    if (!row || this.mobileReminderBusy()) return;
    this.mobileReminderBusy.set(true);
    this.mobileReminderResult.set(null);
    this.api.sendMobileOtpVerificationReminder(row.userType, row.userId).subscribe({
      next: () => {
        this.mobileReminderBusy.set(false);
        this.mobileReminderResult.set('OTP reminder sent.');
      },
      error: (err) => {
        this.mobileReminderBusy.set(false);
        this.mobileReminderResult.set(err?.error?.message || 'Failed to send WhatsApp reminder.');
      },
    });
  }

  sendMobileVerificationReminder(): void {
    const row = this.selectedRow();
    if (!row || this.mobileReminderBusy()) return;
    this.mobileReminderBusy.set(true);
    this.mobileReminderResult.set(null);
    this.api.sendMobileVerificationReminder(row.userType, row.userId).subscribe({
      next: () => {
        this.mobileReminderBusy.set(false);
        this.mobileReminderResult.set('Manual call request sent.');
      },
      error: (err) => {
        this.mobileReminderBusy.set(false);
        this.mobileReminderResult.set(err?.error?.message || 'Failed to send WhatsApp reminder.');
      },
    });
  }
}
