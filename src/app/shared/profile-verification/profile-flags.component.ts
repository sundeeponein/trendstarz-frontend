import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProfileFlag } from '../../services/profile-verification.service';

@Component({
  selector: 'app-profile-flags',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="flags-card">
      <div class="flags-header">
        <div>
          <p class="eyebrow">{{ title }}</p>
          <h3>{{ flags.length || 0 }} open issue{{ flags.length === 1 ? '' : 's' }}</h3>
        </div>
        <button *ngIf="showAdd" type="button" class="icon-btn" (click)="addFlag.emit()" title="Add flag">
          <i class="bi bi-plus-lg"></i>
        </button>
      </div>

      <div class="empty" *ngIf="!flags.length">
        <i class="bi bi-patch-check"></i>
        <span>No open profile issues.</span>
      </div>

      <div class="flag-list" *ngIf="flags.length">
        <article class="flag-row" *ngFor="let flag of flags">
          <div class="flag-main">
            <span class="severity" [ngClass]="flag.severity.toLowerCase()">{{ flag.severity }}</span>
            <strong>{{ flag.message }}</strong>
            <span class="meta">{{ flag.category }} · {{ flag.flagCode }}</span>
          </div>
          <div class="flag-actions" *ngIf="editable">
            <button type="button" (click)="updateFlag.emit({ flag, status: 'Resolved' })">
              <i class="bi bi-check2"></i>
              Resolve
            </button>
            <button type="button" (click)="updateFlag.emit({ flag, status: 'Ignored' })">
              <i class="bi bi-slash-circle"></i>
              Ignore
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
      padding: 0.8rem;
      border: 1px solid #edf1f6;
      border-radius: 10px;
      background: #fbfcfe;
    }
    .flag-main {
      min-width: 0;
      display: grid;
      gap: 0.2rem;
    }
    .flag-main strong {
      color: #16162f;
      font-size: 0.95rem;
    }
    .meta {
      color: #64748b;
      font-size: 0.78rem;
      word-break: break-word;
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
      .flag-row {
        align-items: stretch;
        flex-direction: column;
      }
      .flag-actions {
        flex-wrap: wrap;
      }
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
}
