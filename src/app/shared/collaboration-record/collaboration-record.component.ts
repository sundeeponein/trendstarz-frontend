import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface CollaborationSide {
  total: number;
  accepted: number;
  completedOnTime: number;
  completedLate: number;
  didNotPost: number;
  didNotPostExcused: number;
  inProgress: number;
  disputed: number;
  declined: number;
  awaitingReply: number;
  noResponse: number;
  acceptanceRate: number | null;
  completionRate: number | null;
  campaigns?: number;
}

/**
 * "Collaboration record" — what happened to a person's invites (received as a
 * creator, sent as a host). Shared by the owner's own profile pages
 * (mode "me") and Admin → Users → View user (mode "admin"). Never public.
 */
@Component({
  selector: 'app-collaboration-record',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collaboration-record.component.html',
  styleUrls: ['./collaboration-record.component.scss'],
})
export class CollaborationRecordComponent implements OnChanges {
  @Input() mode: 'me' | 'admin' = 'me';
  /** Admin mode: whose record to show. */
  @Input() userId = '';
  @Input() role = '';

  loading = false;
  error = '';
  asCreator: CollaborationSide | null = null;
  asHost: CollaborationSide | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    this.load();
  }

  private load(): void {
    const role = String(this.role || '').toLowerCase();
    const url =
      this.mode === 'admin'
        ? `${environment.apiBaseUrl}/collaboration-record/admin/${encodeURIComponent(role)}/${encodeURIComponent(this.userId)}`
        : `${environment.apiBaseUrl}/collaboration-record/me`;
    if (this.mode === 'admin' && (!this.userId || !role)) return;
    this.loading = true;
    this.error = '';
    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.asCreator = res?.asCreator ?? null;
        this.asHost = res?.asHost ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Could not load the collaboration record.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  get owner(): boolean {
    return this.mode === 'me';
  }

  rate(v: number | null): string {
    return v === null || v === undefined ? '—' : `${v}%`;
  }
}
