import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * "New number 9123456789 is waiting for verification (up to 24 hours). Until
 * then we'll keep using 9876543210." — a verified number stays in use until an
 * admin verifies the new one (backend utils/pending-mobile.util, 2026-11-10).
 */
@Component({
  selector: 'app-pending-mobile-note',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pending-mobile" *ngIf="pending">
      <i class="bi bi-hourglass-split"></i>
      New number <strong>{{ pending }}</strong> is waiting for verification by our team (up to 24 hours).
      Until then we'll keep using <strong>{{ current }}</strong> — your invites and campaigns continue as normal.
      <button type="button" class="pending-mobile__cancel" [disabled]="busy" (click)="cancel()">Cancel change</button>
      <small class="pending-mobile__error" *ngIf="error">{{ error }}</small>
    </div>
  `,
  styles: [
    `
      .pending-mobile {
        margin: 6px 0;
        padding: 6px 10px;
        border: 1px solid #fde68a;
        border-radius: 8px;
        background: #fffbeb;
        font-size: 0.8rem;
        color: #92400e;
      }
      .pending-mobile__cancel {
        margin-left: 6px;
        padding: 1px 10px;
        border: 1px solid #d97706;
        border-radius: 999px;
        background: #fff;
        font-size: 0.75rem;
        font-weight: 600;
        color: #92400e;
      }
      .pending-mobile__error {
        display: block;
        color: #b91c1c;
      }
    `,
  ],
})
export class PendingMobileNoteComponent {
  private readonly http = inject(HttpClient);
  private readonly cd = inject(ChangeDetectorRef);

  @Input() pending = '';
  @Input() current = '';
  @Output() cancelled = new EventEmitter<void>();
  busy = false;
  error = '';

  cancel(): void {
    this.busy = true;
    this.error = '';
    this.http.post(`${environment.apiBaseUrl}/users/me/mobile-change/cancel`, {}).subscribe({
      next: () => {
        this.busy = false;
        this.cancelled.emit();
        this.cd.markForCheck();
      },
      error: () => {
        this.busy = false;
        this.error = 'Could not cancel. Try again.';
        this.cd.markForCheck();
      },
    });
  }
}
