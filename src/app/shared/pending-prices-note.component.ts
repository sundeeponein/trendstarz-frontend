import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * "Waiting for approval: Instagram · Reel ₹500 → ₹2,000 (brands see ₹500)."
 * Prices that double or more are checked by an admin first (2026-11-10).
 * Change `refreshKey` (e.g. after a save) to load again.
 */
@Component({
  selector: 'app-pending-prices-note',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pending-prices" *ngIf="pending.length">
      <i class="bi bi-hourglass-split"></i>
      <strong>New price waiting for approval</strong> — prices that double or more are checked by our team first.
      Brands see your current price until then.
      <ul>
        <li *ngFor="let p of pending">
          {{ label(p) }}: ₹{{ p.oldPrice | number: '1.0-0' }} → <strong>₹{{ p.newPrice | number: '1.0-0' }}</strong>
          <small>(asked {{ p.createdAt | date: 'd MMM y' }})</small>
        </li>
      </ul>
    </div>
  `,
  styles: [
    `
      .pending-prices {
        margin: 6px 0 10px;
        padding: 8px 12px;
        border: 1px solid #fde68a;
        border-radius: 8px;
        background: #fffbeb;
        font-size: 0.82rem;
        color: #92400e;
      }
      .pending-prices ul {
        margin: 4px 0 0;
        padding-left: 18px;
      }
      .pending-prices small {
        color: #a16207;
      }
    `,
  ],
})
export class PendingPricesNoteComponent implements OnChanges {
  private readonly http = inject(HttpClient);
  private readonly cd = inject(ChangeDetectorRef);

  @Input() refreshKey: unknown = null;
  pending: any[] = [];

  ngOnChanges(): void {
    this.http
      .get<any>(`${environment.apiBaseUrl}/creator/rates/pending`)
      .pipe(catchError(() => of([])))
      .subscribe((res) => {
        const rows = res?.data ?? res;
        this.pending = Array.isArray(rows) ? rows : [];
        this.cd.markForCheck();
      });
  }

  label(p: any): string {
    return [p?.platform, p?.rateName].filter(Boolean).join(' · ');
  }
}
