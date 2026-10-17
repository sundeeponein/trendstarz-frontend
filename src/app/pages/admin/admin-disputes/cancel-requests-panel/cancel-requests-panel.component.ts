import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentsPayoutsApiService } from '../../../../features/payments-payouts/payments-payouts-api.service';
import { CancelRequestItem } from '../../../../features/payments-payouts/payments-payouts.models';

type Draft = { note: string; compensationRupees: string; pauseDays: number };

/**
 * Admin → Disputes: host / creator requests to cancel or pause a paid collaboration.
 * Only TrendStarZ decides; nothing changes for the collaboration until then.
 */
@Component({
  selector: 'app-cancel-requests-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './cancel-requests-panel.component.html',
  styleUrls: ['./cancel-requests-panel.component.scss'],
})
export class CancelRequestsPanelComponent implements OnInit {
  items: CancelRequestItem[] = [];
  loading = false;
  error = '';
  message = '';
  busy = new Set<string>();
  drafts: Record<string, Draft> = {};

  constructor(
    private api: PaymentsPayoutsApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.listCancelRequests().subscribe({
      next: (res) => {
        this.items = res?.data || [];
        for (const i of this.items) {
          this.drafts[i.inviteId] ??= { note: '', compensationRupees: '', pauseDays: 7 };
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Could not load cancel / pause requests.';
        this.cdr.markForCheck();
      },
    });
  }

  rupees(paise: number): string {
    return `₹${(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
  }

  canDecide(item: CancelRequestItem): boolean {
    return (this.drafts[item.inviteId]?.note || '').trim().length >= 10 && !this.busy.has(item.inviteId);
  }

  decide(item: CancelRequestItem, decision: 'approve' | 'reject'): void {
    const d = this.drafts[item.inviteId];
    if (!d || !this.canDecide(item)) return;
    const rupees = Number(d.compensationRupees);
    this.busy.add(item.inviteId);
    this.error = '';
    this.api
      .decideCancelRequest(item.inviteId, {
        decision,
        note: d.note.trim(),
        compensation:
          decision === 'approve' && item.request.type === 'cancel' && rupees > 0 ? Math.round(rupees * 100) : undefined,
        pauseDays: decision === 'approve' && item.request.type === 'pause' ? Number(d.pauseDays) : undefined,
      })
      .subscribe({
        next: () => {
          this.busy.delete(item.inviteId);
          this.items = this.items.filter((i) => i.inviteId !== item.inviteId);
          this.message = decision === 'approve' ? 'Request approved.' : 'Request rejected.';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.busy.delete(item.inviteId);
          this.error = err?.error?.message || 'Decision failed.';
          this.cdr.markForCheck();
        },
      });
  }
}
