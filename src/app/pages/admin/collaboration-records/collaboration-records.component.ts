import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { CollaborationSide } from '../../../shared/collaboration-record/collaboration-record.component';

interface RecordRow extends CollaborationSide {
  userId: string;
  role: 'influencer' | 'brand' | 'photographer' | null;
  name: string;
  username: string;
  removed: boolean;
}

type SortKey = 'didNotPost' | 'completedLate' | 'completionRate' | 'acceptanceRate' | 'total' | 'name';
type Preset = 'all' | 'noShows' | 'lowCompletion' | 'late' | 'reliable';

/**
 * Admin → Users → Collaboration records: every creator's (invites received) or
 * host's (invites sent) record in one table — who doesn't post, who is late,
 * who is reliable. Same counts as the per-user box (shared backend rule).
 */
@Component({
  selector: 'app-collaboration-records',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './collaboration-records.component.html',
  styleUrls: ['./collaboration-records.component.scss'],
})
export class CollaborationRecordsComponent implements OnInit {
  side: 'creator' | 'host' = 'creator';
  rows: RecordRow[] = [];
  loading = false;
  error = '';

  search = '';
  role: '' | 'influencer' | 'brand' | 'photographer' = '';
  preset: Preset = 'all';
  hideRemoved = true;
  sortKey: SortKey = 'didNotPost';
  sortDesc = true;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  setSide(side: 'creator' | 'host'): void {
    if (this.side === side) return;
    this.side = side;
    this.role = '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<any>(`${environment.apiBaseUrl}/collaboration-record/admin/list?side=${this.side}`).subscribe({
      next: (res) => {
        this.rows = Array.isArray(res?.rows) ? res.rows : [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Could not load campaign records.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private matchesPreset(r: RecordRow): boolean {
    switch (this.preset) {
      case 'noShows':
        return r.didNotPost - r.didNotPostExcused >= 1;
      case 'lowCompletion':
        return r.completionRate !== null && r.completionRate < 70;
      case 'late':
        return r.completedLate >= 1;
      case 'reliable':
        return r.completedOnTime + r.completedLate >= 2 && r.didNotPost === 0 && r.completedLate === 0;
      default:
        return true;
    }
  }

  get visibleRows(): RecordRow[] {
    const q = this.search.trim().toLowerCase();
    const list = this.rows.filter(
      (r) =>
        (!this.hideRemoved || !r.removed) &&
        (!this.role || r.role === this.role) &&
        (!q || r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q)) &&
        this.matchesPreset(r),
    );
    const dir = this.sortDesc ? -1 : 1;
    return list.sort((a, b) => {
      if (this.sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      // Empty rates sort last either way.
      const av = a[this.sortKey] ?? (this.sortDesc ? -1 : 1e9);
      const bv = b[this.sortKey] ?? (this.sortDesc ? -1 : 1e9);
      return ((av as number) - (bv as number)) * dir || b.total - a.total;
    });
  }

  get totals() {
    const v = this.visibleRows;
    return {
      people: v.length,
      invites: v.reduce((n, r) => n + r.total, 0),
      didNotPost: v.reduce((n, r) => n + r.didNotPost, 0),
      late: v.reduce((n, r) => n + r.completedLate, 0),
    };
  }

  sortBy(key: SortKey): void {
    if (this.sortKey === key) this.sortDesc = !this.sortDesc;
    else {
      this.sortKey = key;
      this.sortDesc = key !== 'name';
    }
  }

  rate(v: number | null): string {
    return v === null || v === undefined ? '—' : `${v}%`;
  }

  rateClass(v: number | null): string {
    if (v === null || v === undefined) return '';
    return v >= 85 ? 'good' : v >= 60 ? 'warn' : 'bad';
  }
}
