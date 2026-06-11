import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-flag-management-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dialog-backdrop" *ngIf="open" (click)="close.emit()"></div>
    <section class="flag-dialog" *ngIf="open" role="dialog" aria-modal="true">
      <header>
        <h2>Add Profile Flag</h2>
        <button type="button" class="close-btn" (click)="close.emit()" aria-label="Close">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <label>
        Category
        <select [(ngModel)]="form.category">
          <option *ngFor="let category of categories" [value]="category">{{ category }}</option>
        </select>
      </label>

      <label>
        Flag code
        <select [(ngModel)]="form.flagCode">
          <option *ngFor="let code of flagCodes" [value]="code">{{ code }}</option>
        </select>
      </label>

      <label>
        Severity
        <select [(ngModel)]="form.severity">
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </label>

      <label>
        Message
        <textarea rows="3" [(ngModel)]="form.message"></textarea>
      </label>

      <footer>
        <button type="button" class="secondary" (click)="close.emit()">Cancel</button>
        <button type="button" class="primary" (click)="save.emit(form)">Add flag</button>
      </footer>
    </section>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      z-index: 1000;
    }
    .flag-dialog {
      position: fixed;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      width: min(92vw, 520px);
      border-radius: 12px;
      background: #fff;
      border: 1px solid #d7deea;
      box-shadow: 0 18px 70px rgba(15, 23, 42, 0.25);
      padding: 1rem;
      z-index: 1001;
      display: grid;
      gap: 0.8rem;
    }
    header,
    footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8rem;
    }
    h2 {
      margin: 0;
      color: #16162f;
      font-size: 1.15rem;
      font-weight: 900;
    }
    .close-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 0;
      background: #f2f4f8;
      color: #465468;
    }
    label {
      display: grid;
      gap: 0.35rem;
      color: #465468;
      font-size: 0.82rem;
      font-weight: 800;
    }
    select,
    textarea {
      width: 100%;
      border: 1px solid #d7deea;
      border-radius: 9px;
      padding: 0.55rem 0.7rem;
      color: #16162f;
      font: inherit;
    }
    footer {
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-top: 0.3rem;
    }
    footer button {
      border-radius: 9px;
      padding: 0.5rem 0.8rem;
      font-weight: 900;
      border: 1px solid #d7deea;
    }
    .primary {
      background: #e8580c;
      border-color: #e8580c;
      color: #fff;
    }
    .secondary {
      background: #fff;
      color: #16162f;
    }
  `],
})
export class FlagManagementDialogComponent {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  categories = ['Identity', 'Location', 'Social Media', 'Content', 'Portfolio', 'Verification', 'Payment'];
  flagCodes = [
    'PROFILE_PHOTO_MISSING',
    'PROFILE_PHOTO_SCREENSHOT',
    'SOCIAL_LINK_BROKEN',
    'SOCIAL_LINK_MISMATCH',
    'FOLLOWER_COUNT_MISMATCH',
    'TIER_MISMATCH',
    'NICHE_MISMATCH',
    'PORTFOLIO_LOW_QUALITY',
    'PAYMENT_MISSING',
    'PAN_MISSING',
  ];
  form = {
    category: 'Identity',
    flagCode: 'PROFILE_PHOTO_SCREENSHOT',
    severity: 'Medium',
    message: '',
  };
}
