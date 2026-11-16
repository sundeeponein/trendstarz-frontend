import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { buildOutreachLink, OUTREACH_PAGES, OUTREACH_SOURCES } from './outreach-link.util';

/**
 * Admin → Growth (growth plan 2026-11-16): the Monday scorecard, brand shortlist
 * requests, invites nobody answered, a tagged-link maker for outreach, and
 * where signups came from.
 */
@Component({
  selector: 'app-admin-growth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-growth.component.html',
  styleUrls: ['./admin-growth.component.scss'],
})
export class AdminGrowthComponent implements OnInit {
  private readonly base = `${environment.apiBaseUrl}/admin/growth`;
  readonly site = (environment as any).frontendUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://trendstarz.in');

  card: any = null;
  cardError = '';
  requests: any[] = [];
  requestFilter = 'new';
  requestsError = '';
  savingId = '';
  unanswered: any[] = [];
  unansweredError = '';
  copied = '';

  readonly budgets: Record<string, string> = {
    under_5k: 'Under ₹5,000',
    '5k_20k': '₹5,000 – ₹20,000',
    '20k_50k': '₹20,000 – ₹50,000',
    '50k_plus': '₹50,000+',
    barter: 'Free product / visit',
    not_sure: 'Not sure yet',
  };
  readonly statuses = ['new', 'contacted', 'converted', 'closed'];

  readonly pages = OUTREACH_PAGES;
  readonly sources = OUTREACH_SOURCES;
  link = { page: '/creator-shortlist', source: 'whatsapp', medium: '', campaign: '' };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadCard();
    this.loadRequests();
    this.loadUnanswered();
  }

  private unwrap(res: any) {
    return res?.data !== undefined && res?.success !== undefined ? res.data : res;
  }

  loadCard(): void {
    this.http.get<any>(`${this.base}/scorecard`).subscribe({
      next: (res) => {
        this.card = this.unwrap(res);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cardError = err?.error?.message || 'Could not load the scorecard.';
        this.cdr.markForCheck();
      },
    });
  }

  loadRequests(): void {
    const params: Record<string, string> = this.requestFilter ? { status: this.requestFilter } : {};
    this.http.get<any>(`${this.base}/shortlist-requests`, { params }).subscribe({
      next: (res) => {
        const rows = this.unwrap(res);
        this.requests = Array.isArray(rows) ? rows : [];
        this.requestsError = '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.requestsError = err?.error?.message || 'Could not load shortlist requests.';
        this.cdr.markForCheck();
      },
    });
  }

  loadUnanswered(): void {
    this.http.get<any>(`${this.base}/unanswered-invites`).subscribe({
      next: (res) => {
        const rows = this.unwrap(res);
        this.unanswered = Array.isArray(rows) ? rows : [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.unansweredError = err?.error?.message || 'Could not load unanswered invites.';
        this.cdr.markForCheck();
      },
    });
  }

  saveRequest(r: any, patch: { status?: string; adminNote?: string }): void {
    this.savingId = r._id;
    this.http.patch<any>(`${this.base}/shortlist-requests/${r._id}`, patch).subscribe({
      next: (res) => {
        Object.assign(r, this.unwrap(res) || patch);
        this.savingId = '';
        // A request that left the filtered status drops out of the list on the next load.
        this.loadCard();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingId = '';
        this.requestsError = err?.error?.message || 'Could not save.';
        this.cdr.markForCheck();
      },
    });
  }

  /** wa.me link to the brand with a short opening line. */
  requestWhatsApp(r: any): string {
    const where = [r.city, r.state].filter(Boolean).join(', ');
    const text = `Hi ${r.name}, this is TrendStarZ. Thanks for asking for a creator shortlist for ${r.businessName}. Here are 5 ${r.category} creators${where ? ` near ${where}` : ''} who fit your budget:`;
    return `https://wa.me/91${String(r.phone || '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;
  }

  /** wa.me link to the creator, reminding them to answer the invite. */
  inviteWhatsApp(u: any): string {
    const name = String(u.creatorName || '').split(' ')[0] || 'there';
    const text = `Hi ${name}, this is TrendStarZ. ${u.hostName || 'A brand'} invited you to "${u.campaignTitle}" and is waiting for your reply. Please accept or decline here: ${u.inviteLink}`;
    return `https://wa.me/91${String(u.creatorPhone || '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;
  }

  waited(hours: number): string {
    return hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} h`;
  }

  get outreachLink(): string {
    return buildOutreachLink(this.site, this.link);
  }

  async copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied = key;
    } catch {
      this.copied = '';
      window.prompt('Copy this:', text);
    }
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.copied === key) {
        this.copied = '';
        this.cdr.markForCheck();
      }
    }, 2000);
  }
}
