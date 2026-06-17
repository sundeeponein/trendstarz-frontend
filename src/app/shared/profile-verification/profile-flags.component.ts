import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProfileFlag } from '../../services/profile-verification.service';

// --- Flag code classification ------------------------------------------

const PHOTO_POLICY_CODES = new Set([
  'PROFILE_PHOTO_POLICY', 'PROFILE_PHOTO_CONTACT_INFO', 'PROFILE_PHOTO_QR_CODE',
]);

const PHOTO_QUALITY_CODES = new Set([
  'PROFILE_PHOTO_QUALITY', 'PROFILE_PHOTO_BLURRY', 'PROFILE_PHOTO_LOW_QUALITY',
]);

const PHOTO_FACE_CODES = new Set([
  'PROFILE_PHOTO_GROUP', 'FACE_NOT_VISIBLE',
]);

const PHOTO_SCREENSHOT_CODES = new Set([
  'PROFILE_PHOTO_SCREENSHOT',
]);

const PHOTO_IDENTITY_CODES = new Set([
  'PROFILE_PHOTO_CELEBRITY', 'PROFILE_PHOTO_LOGO',
]);

const ALL_PHOTO_QUALITY_CODES = new Set([
  ...PHOTO_QUALITY_CODES, ...PHOTO_FACE_CODES, ...PHOTO_SCREENSHOT_CODES, ...PHOTO_IDENTITY_CODES,
]);

const GALLERY_CODES = new Set([
  'PORTFOLIO_MISSING', 'PORTFOLIO_SCREENSHOT', 'PORTFOLIO_LOW_QUALITY',
  'PORTFOLIO_DUPLICATE', 'PORTFOLIO_WATERMARK',
]);

const POLICY_REASON_LABELS: Record<string, string> = {
  PROFILE_PHOTO_CONTACT_INFO: 'Contact information detected',
  PROFILE_PHOTO_QR_CODE: 'QR code or booking link detected',
  PROFILE_PHOTO_POLICY: 'Other policy violation',
};

const PHOTO_QUALITY_REASON_LABELS: Record<string, string> = {
  PROFILE_PHOTO_QUALITY: 'Quality issue',
  PROFILE_PHOTO_BLURRY: 'Blurry photo',
  PROFILE_PHOTO_LOW_QUALITY: 'Low quality photo',
  PROFILE_PHOTO_GROUP: 'Group photo',
  FACE_NOT_VISIBLE: 'Face not visible',
  PROFILE_PHOTO_SCREENSHOT: 'Screenshot',
  PROFILE_PHOTO_CELEBRITY: 'Identity issue',
  PROFILE_PHOTO_LOGO: 'Logo or non-personal image',
};

const GALLERY_REASON_LABELS: Record<string, string> = {
  PORTFOLIO_MISSING: 'No valid gallery images',
  PORTFOLIO_SCREENSHOT: 'Screenshots',
  PORTFOLIO_LOW_QUALITY: 'Low quality images',
  PORTFOLIO_DUPLICATE: 'Duplicate images',
  PORTFOLIO_WATERMARK: 'Watermarked images',
};

interface FlagGroup {
  id: string;
  severity: 'High' | 'Medium';
  title: string;
  reasons: string[];
  flags: ProfileFlag[];
}

@Component({
  selector: 'app-profile-flags',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="flags-card">
      <div class="flags-header">
        <div>
          <p class="eyebrow">{{ title }}</p>
          <h3>{{ groups.length }} open issue{{ groups.length === 1 ? '' : 's' }}</h3>
          <p class="helper" *ngIf="editable && groups.length">
            Resolve closes a fixed issue. Ignore hides a non-blocking issue from this review.
          </p>
        </div>
        <button *ngIf="showAdd" type="button" class="icon-btn" (click)="addFlag.emit()" title="Add flag">
          <i class="bi bi-plus-lg"></i>
        </button>
      </div>

      <div class="empty" *ngIf="!groups.length">
        <i class="bi bi-patch-check"></i>
        <span>No open profile issues.</span>
      </div>

      <div class="flag-list" *ngIf="groups.length">
        <article class="flag-row" *ngFor="let group of groups" [ngClass]="'row-' + group.severity.toLowerCase()">
          <div class="flag-main">
            <span class="severity" [ngClass]="group.severity.toLowerCase()">{{ group.severity }}</span>
            <strong>{{ group.title }}</strong>
            <span class="meta" *ngIf="group.reasons.length">
              {{ group.reasons.join(' · ') }}
            </span>
          </div>
          <div class="flag-actions" *ngIf="editable">
            <button type="button" (click)="resolveAll(group.flags)">
              <i class="bi bi-check2"></i> Resolve
            </button>
            <button type="button" (click)="ignoreAll(group.flags)">
              <i class="bi bi-slash-circle"></i> Ignore
            </button>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .flags-card {
      border: 1px solid #e1e6ef;
      border-radius: 12px;
      padding: 1.2rem;
      background: #fff;
    }
    .flags-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.9rem;
    }
    .eyebrow {
      margin: 0 0 0.2rem;
      color: #657082;
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }
    h3 {
      margin: 0;
      color: #16162f;
      font-size: 1.2rem;
      font-weight: 800;
    }
    .helper {
      margin: 0.3rem 0 0;
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 700;
      line-height: 1.35;
    }
    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid #d7deea;
      background: #fff;
      color: #16162f;
    }
    .empty {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: #64748b;
      padding: 0.8rem;
      border-radius: 10px;
      background: #f8fafc;
      font-weight: 700;
    }
    .empty i { color: #2da64a; }
    .flag-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .flag-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 1rem;
      border: 1px solid #edf1f6;
      border-radius: 10px;
      background: #fbfcfe;
    }
    .flag-row.row-high {
      border-color: #ffd8c2;
      background: #fff8f4;
    }
    .flag-row.row-medium {
      border-color: #ffeec2;
      background: #fffdf0;
    }
    .flag-main {
      min-width: 0;
      display: grid;
      gap: 0.25rem;
    }
    .flag-main strong {
      color: #16162f;
      font-size: 0.95rem;
    }
    .meta {
      color: #64748b;
      font-size: 0.78rem;
    }
    .severity {
      width: fit-content;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
    }
    .severity.high { background: #fff0ef; color: #bd2d20; }
    .severity.medium { background: #fff5e5; color: #b45b00; }
    .severity.low { background: #eef1f6; color: #465468; }
    .flag-actions {
      display: flex;
      gap: 0.4rem;
      flex-shrink: 0;
    }
    .flag-actions button {
      border: 1px solid #d7deea;
      background: #fff;
      border-radius: 8px;
      padding: 0.35rem 0.65rem;
      color: #16162f;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    @media (max-width: 720px) {
      .flag-row { align-items: stretch; flex-direction: column; }
      .flag-actions { flex-wrap: wrap; }
    }
  `],
})
export class ProfileFlagsComponent {
  @Input() title = 'Action Required';
  @Input() flags: ProfileFlag[] = [];
  @Input() editable = false;
  @Input() showAdd = false;
  @Output() updateFlag = new EventEmitter<{ flag: ProfileFlag; status: 'Resolved' | 'Ignored' }>();
  @Output() addFlag = new EventEmitter<void>();

  get groups(): FlagGroup[] {
    const open = (this.flags || []).filter((f) => f.status === 'Open');
    const groups: FlagGroup[] = [];

    const policyFlags = open.filter((f) => PHOTO_POLICY_CODES.has(String(f.flagCode)));
    if (policyFlags.length) {
      groups.push({
        id: 'photo-policy',
        severity: 'High',
        title: 'Profile Photo Policy Violation',
        reasons: policyFlags.map((f) => POLICY_REASON_LABELS[String(f.flagCode)] || String(f.flagCode)),
        flags: policyFlags,
      });
    }

    const photoQualityFlags = open.filter((f) => ALL_PHOTO_QUALITY_CODES.has(String(f.flagCode)));
    if (photoQualityFlags.length) {
      groups.push({
        id: 'photo-quality',
        severity: 'Medium',
        title: 'Profile Photo Requires Update',
        reasons: photoQualityFlags.map((f) => PHOTO_QUALITY_REASON_LABELS[String(f.flagCode)] || String(f.flagCode)),
        flags: photoQualityFlags,
      });
    }

    const galleryFlags = open.filter((f) => GALLERY_CODES.has(String(f.flagCode)));
    if (galleryFlags.length) {
      groups.push({
        id: 'gallery',
        severity: 'Medium',
        title: 'Gallery Images Require Update',
        reasons: galleryFlags.map((f) => GALLERY_REASON_LABELS[String(f.flagCode)] || String(f.flagCode)),
        flags: galleryFlags,
      });
    }

    // Any remaining flags not in the above categories
    const knownFlags = new Set([...PHOTO_POLICY_CODES, ...ALL_PHOTO_QUALITY_CODES, ...GALLERY_CODES]);
    const otherFlags = open.filter((f) => !knownFlags.has(String(f.flagCode)));
    for (const flag of otherFlags) {
      groups.push({
        id: `other-${flag.flagCode}`,
        severity: flag.severity as 'High' | 'Medium',
        title: flag.message || String(flag.flagCode),
        reasons: [`${flag.category} · ${flag.flagCode}`],
        flags: [flag],
      });
    }

    return groups;
  }

  resolveAll(flags: ProfileFlag[]): void {
    for (const flag of flags) {
      this.updateFlag.emit({ flag, status: 'Resolved' });
    }
  }

  ignoreAll(flags: ProfileFlag[]): void {
    for (const flag of flags) {
      this.updateFlag.emit({ flag, status: 'Ignored' });
    }
  }
}
