import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { VerificationChecklistItem } from '../../services/profile-verification.service';

@Component({
  selector: 'app-verification-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="verification-card">
      <div class="score-row">
        <div>
          <p class="eyebrow">Profile Completion</p>
          <strong>{{ completion }}%</strong>
        </div>
        <div class="meter" aria-hidden="true">
          <span [style.width.%]="completion"></span>
        </div>
      </div>

      <div class="score-grid">
        <div>
          <p class="eyebrow">Quality Score</p>
          <strong>{{ qualityScore }}/100</strong>
          <span class="quality-label">{{ qualityLabel }}</span>
        </div>
        <div>
          <p class="eyebrow">Verification Status</p>
          <span class="status-pill" [ngClass]="statusClass">{{ status }}</span>
        </div>
      </div>

      <div class="checklist">
        <div class="check-item" *ngFor="let item of checklist">
          <i class="bi" [ngClass]="iconFor(item.status)"></i>
          <div>
            <strong>{{ item.label }}</strong>
            <span [ngClass]="statusClassFor(item.status)">{{ item.status }}</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .verification-card {
      border: 1px solid #e1e6ef;
      border-radius: 12px;
      padding: 1.2rem;
      background: #fff;
    }
    .eyebrow {
      margin: 0 0 0.25rem;
      color: #657082;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .score-row {
      display: grid;
      grid-template-columns: minmax(130px, 180px) 1fr;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    strong {
      color: #16162f;
      font-size: 1.25rem;
      line-height: 1.2;
    }
    .meter {
      height: 10px;
      background: #eef1f6;
      border-radius: 999px;
      overflow: hidden;
    }
    .meter span {
      display: block;
      height: 100%;
      min-width: 4px;
      background: #2da64a;
      border-radius: inherit;
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .quality-label {
      display: block;
      color: #657082;
      font-size: 0.85rem;
      margin-top: 0.15rem;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-weight: 800;
      background: #eef1f6;
      color: #16162f;
    }
    .status-pill.good { background: #e8f7ee; color: #1f8d43; }
    .status-pill.warn { background: #fff5e5; color: #b45b00; }
    .status-pill.bad { background: #fff0ef; color: #bd2d20; }
    .checklist {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
    }
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      padding: 0.7rem;
      border-radius: 10px;
      background: #f8fafc;
    }
    .check-item i {
      color: #2da64a;
      font-size: 1.1rem;
      margin-top: 0.1rem;
    }
    .check-item .bi-exclamation-triangle { color: #e8580c; }
    .check-item .bi-x-circle { color: #bd2d20; }
    .check-item .bi-hourglass-split { color: #64748b; }
    .check-item div {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }
    .check-item strong {
      font-size: 0.92rem;
    }
    .check-item span {
      color: #64748b;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .check-item span.good { color: #1f8d43; }
    .check-item span.warn { color: #b45b00; }
    .check-item span.bad { color: #bd2d20; }
    @media (max-width: 680px) {
      .score-row,
      .score-grid,
      .checklist {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class VerificationStatusComponent {
  @Input() completion = 0;
  @Input() qualityScore = 0;
  @Input() qualityLabel = '';
  @Input() status = 'Draft';
  @Input() checklist: VerificationChecklistItem[] = [];

  get statusClass(): string {
    if (['Premium Verified', 'Brand Ready', 'Verified Creator'].includes(this.status)) return 'good';
    if (['Action Required'].includes(this.status)) return 'bad';
    return 'warn';
  }

  iconFor(status: string): string {
    if (status === 'Verified') return 'bi-check-circle-fill';
    if (status === 'Failed') return 'bi-x-circle';
    if (status === 'Pending') return 'bi-hourglass-split';
    return 'bi-exclamation-triangle';
  }

  statusClassFor(status: string): string {
    if (status === 'Verified') return 'good';
    if (status === 'Failed' || status === 'Action Required') return 'bad';
    return 'warn';
  }
}
