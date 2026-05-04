import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../../shared/config.service';

type DisputeStatus = 'open' | 'resolved' | 'all';

@Component({
  selector: 'app-admin-disputes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-disputes.component.html',
  styleUrls: ['./admin-disputes.component.scss'],
})
export class AdminDisputesComponent implements OnInit {
  invites: any[] = [];
  loading = true;
  error = '';
  statusFilter: DisputeStatus = 'open';
  notes: { [id: string]: string } = {};
  acting = new Set<string>();
  toast = '';
  selected = new Set<string>();
  bulkOutcome: 'completed' | 'withdrawn' | 'disputed' = 'completed';
  bulkNote = '';
  bulkActing = false;

  constructor(private config: ConfigService, private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  setFilter(s: DisputeStatus) {
    if (this.statusFilter === s) return;
    this.statusFilter = s;
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';
    this.config.adminListDisputes(this.statusFilter).subscribe({
      next: (res: any) => {
        const payload = res?.data || res;
        this.invites = payload?.invites || [];
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load disputes.';
        this.loading = false;
        this.cd.detectChanges();
      },
    });
  }

  resolve(inv: any, outcome: 'completed' | 'withdrawn' | 'disputed') {
    if (this.acting.has(inv._id)) return;
    const note = this.notes[inv._id]?.trim();
    this.acting.add(inv._id);
    this.config
      .adminResolveDispute(inv._id, { outcome, note: note || undefined })
      .subscribe({
        next: () => {
          this.acting.delete(inv._id);
          this.invites = this.invites.filter((i) => i._id !== inv._id);
          this.flash(
            outcome === 'completed'
              ? 'Marked as completed.'
              : outcome === 'withdrawn'
                ? 'Marked as withdrawn.'
                : 'Resolved (kept as disputed).',
          );
          this.cd.detectChanges();
        },
        error: (err: any) => {
          this.acting.delete(inv._id);
          this.error = err?.error?.message || 'Resolve failed.';
          this.cd.detectChanges();
        },
      });
  }

  isResolved(inv: any): boolean {
    return !!inv?.reportedIssue?.resolvedAt;
  }

  toggleSelected(inv: any, checked: boolean) {
    if (checked) this.selected.add(inv._id);
    else this.selected.delete(inv._id);
  }

  isSelected(inv: any): boolean {
    return this.selected.has(inv._id);
  }

  toggleSelectAll(checked: boolean) {
    if (!checked) {
      this.selected.clear();
      return;
    }
    for (const inv of this.invites) {
      if (!this.isResolved(inv)) this.selected.add(inv._id);
    }
  }

  allSelectableSelected(): boolean {
    const eligible = this.invites.filter((i) => !this.isResolved(i));
    return eligible.length > 0 && eligible.every((i) => this.selected.has(i._id));
  }

  bulkResolve() {
    if (this.bulkActing) return;
    const ids = Array.from(this.selected);
    if (ids.length === 0) return;
    this.bulkActing = true;
    this.config
      .adminBulkResolveDisputes({
        inviteIds: ids,
        outcome: this.bulkOutcome,
        note: this.bulkNote.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.bulkActing = false;
          this.selected.clear();
          this.bulkNote = '';
          this.flash(
            `Bulk resolved: ${res?.resolved ?? 0}` +
              (res?.skipped ? `, skipped: ${res.skipped}` : ''),
          );
          this.load();
        },
        error: (err) => {
          this.bulkActing = false;
          this.error = err?.error?.message || 'Bulk resolve failed.';
          this.cd.detectChanges();
        },
      });
  }

  reportedAt(inv: any): string {
    const d = inv?.reportedIssue?.reportedAt;
    return d ? new Date(d).toLocaleString() : '';
  }

  private flash(msg: string) {
    this.toast = msg;
    setTimeout(() => {
      this.toast = '';
      this.cd.detectChanges();
    }, 2500);
  }
}
