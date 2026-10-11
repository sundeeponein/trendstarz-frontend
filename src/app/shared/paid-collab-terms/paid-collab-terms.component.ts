import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PAID_COLLAB_TERMS, PAID_COLLAB_TERMS_V2_ADDITIONS } from './paid-collab-terms';

/** Checkbox + summary of the paid-collaboration terms (host when paying, creator when accepting). */
@Component({
  selector: 'app-paid-collab-terms',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pct" [class.pct--compact]="compact">
      <ul class="pct-list">
        <li *ngFor="let t of terms">{{ t }}</li>
        <ng-container *ngIf="v2">
          <li *ngFor="let t of v2Terms">{{ t }}</li>
        </ng-container>
      </ul>
      <label class="pct-check">
        <input type="checkbox" [checked]="accepted" (change)="toggle($event)" />
        <span>I agree to these paid-collaboration terms.</span>
      </label>
    </div>
  `,
  styles: [
    `
      .pct {
        margin: 10px 0 14px;
        padding: 10px 12px;
        border: 1px solid var(--ts-border, #e2e8f0);
        border-radius: 10px;
        background: #f8fafc;
        color: #1e293b;
        font-size: 13px;
        text-align: left;
      }
      .pct-list {
        margin: 0 0 8px;
        padding-left: 18px;
        color: var(--ts-text-muted, #475569);
      }
      .pct-list li + li {
        margin-top: 4px;
      }
      .pct-check {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        font-weight: 600;
        cursor: pointer;
        margin: 0;
      }
      .pct-check input {
        margin-top: 3px;
      }
      .pct--compact .pct-list {
        font-size: 12px;
      }
      :host-context([data-theme='dark']) .pct {
        color: #e2e8f0;
        background: rgba(148, 163, 184, 0.08);
        border-color: rgba(148, 163, 184, 0.25);
      }
    `,
  ],
})
export class PaidCollabTermsComponent {
  @Input() accepted = false;
  @Input() compact = false;
  /** Terms v2 is active: also show the paid-slot and fee-credit rules. */
  @Input() v2 = false;
  readonly v2Terms = PAID_COLLAB_TERMS_V2_ADDITIONS;
  @Output() acceptedChange = new EventEmitter<boolean>();
  readonly terms = PAID_COLLAB_TERMS;

  toggle(ev: Event) {
    this.accepted = (ev.target as HTMLInputElement).checked;
    this.acceptedChange.emit(this.accepted);
  }
}
