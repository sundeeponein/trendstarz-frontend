import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { buildOutreachLink, OUTREACH_PAGES, OUTREACH_SOURCES } from './outreach-link.util';
import { shortlistMessage, signupMessage } from './shortlist-message.util';

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

  /** "Build shortlist" panel under one request (2026-11-16). */
  building: {
    id: string;
    loading: boolean;
    error: string;
    candidates: any[];
    inNiche: number;
    selected: Set<string>;
    signupLink: string;
    message: string;
  } | null = null;
  signupBusyId = '';

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

  buildShortlist(r: any): void {
    if (this.building?.id === r._id) {
      this.building = null;
      return;
    }
    const b = { id: r._id, loading: true, error: '', candidates: [] as any[], inNiche: 0, selected: new Set<string>(), signupLink: '', message: '' };
    this.building = b;
    this.http.get<any>(`${this.base}/shortlist-requests/${r._id}/matches`).subscribe({
      next: (res) => {
        if (this.building !== b) return;
        const data = this.unwrap(res) || {};
        b.candidates = Array.isArray(data.candidates) ? data.candidates : [];
        b.inNiche = Number(data.inNiche || 0);
        b.candidates.slice(0, 5).forEach((c) => b.selected.add(c.id));
        b.loading = false;
        this.recompose(r);
      },
      error: (err) => {
        b.loading = false;
        b.error = err?.error?.message || 'Could not find creators.';
        this.cdr.markForCheck();
      },
    });
    this.withSignupLink(r, (link) => {
      if (this.building !== b) return;
      b.signupLink = link;
      this.recompose(r);
    });
  }

  toggleCandidate(r: any, c: any): void {
    const b = this.building;
    if (!b) return;
    if (b.selected.has(c.id)) b.selected.delete(c.id);
    else b.selected.add(c.id);
    this.recompose(r);
  }

  private recompose(r: any): void {
    const b = this.building;
    if (!b) return;
    const picked = b.candidates.filter((c) => b.selected.has(c.id));
    b.message = shortlistMessage(r, picked, this.site, b.signupLink);
    this.cdr.markForCheck();
  }

  private withSignupLink(r: any, done: (link: string) => void): void {
    this.http.get<any>(`${this.base}/shortlist-requests/${r._id}/signup-link`).subscribe({
      next: (res) => done(String(this.unwrap(res)?.link || '')),
      error: () => done(''),
    });
  }

  /** wa.me link to the brand carrying a whole message. */
  whatsAppWith(r: any, text: string): string {
    return `https://wa.me/91${String(r.phone || '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;
  }

  /** After sending the shortlist, a new request becomes "contacted". */
  markSent(r: any): void {
    if (r.status === 'new') this.saveRequest(r, { status: 'contacted' });
  }

  /** "Signup link" button: open WhatsApp with just the signup link (details prefilled for them). */
  sendSignupLink(r: any): void {
    this.signupBusyId = r._id;
    // Open the window now (inside the click) so pop-up blockers allow it, then point it at WhatsApp.
    const win = window.open('', '_blank');
    this.withSignupLink(r, (link) => {
      this.signupBusyId = '';
      if (!link) {
        win?.close();
        this.requestsError = 'Could not make the signup link.';
      } else if (win) {
        win.location.href = this.whatsAppWith(r, signupMessage(r, link));
      } else {
        this.copy(signupMessage(r, link), 'signup-' + r._id);
      }
      this.cdr.markForCheck();
    });
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
