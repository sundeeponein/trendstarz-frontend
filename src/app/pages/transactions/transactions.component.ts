import { Component, OnInit, ChangeDetectorRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { WarmupService } from '../../core/warmup.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss'],
})
export class TransactionsComponent implements OnInit {
  transactions: any[] = [];
  loading = true;
  error = '';
  activeTab: 'pending' | 'completed' = 'pending';

  /** Summary values in paise */
  summary = { totalEarned: 0, totalPending: 0, totalPaid: 0 };

  constructor(
    private config: ConfigService,
    public session: SessionService,
    private warmup: WarmupService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.warmup.ready.then(() => this.load());
  }

  get role(): string {
    return this.session.getUser()?.role || '';
  }

  get isInfluencer(): boolean { return this.role === 'influencer'; }
  get isBrand(): boolean { return this.role === 'brand'; }

  /** Tabs labelling by role */
  get pendingLabel(): string { return 'Pending'; }
  get completedLabel(): string {
    return this.isInfluencer ? 'Received' : 'Paid Out';
  }

  get pendingTab(): any[] {
    return this.transactions.filter(tx => {
      if (this.isInfluencer) {
        // influencer is the recipient; pending = collection verified but payout not yet paid
        return tx.payoutStatus === 'pending' || tx.payoutStatus === 'processing'
          || (tx.collectionStatus !== 'verified' && tx.payoutStatus !== 'paid');
      }
      // brand is the payer; pending = proof not yet verified by admin
      return tx.collectionStatus === 'awaiting_payment' || tx.collectionStatus === 'proof_submitted';
    });
  }

  get completedTab(): any[] {
    return this.transactions.filter(tx => {
      if (this.isInfluencer) {
        return tx.payoutStatus === 'paid';
      }
      // brand: collection verified (payment confirmed / accepted by admin)
      return tx.collectionStatus === 'verified';
    });
  }

  get activeRows(): any[] {
    return this.activeTab === 'pending' ? this.pendingTab : this.completedTab;
  }

  load() {
    this.loading = true;
    this.config.getMyCampaignTransactions().subscribe({
      next: (rows) => {
        this.transactions = rows;
        this.computeSummary(rows);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load transactions.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private computeSummary(rows: any[]) {
    if (this.isInfluencer) {
      this.summary.totalEarned = rows
        .filter(r => r.payoutStatus === 'paid' && r.recipientRole === 'influencer')
        .reduce((s, r) => s + Number(r.recipientPayout || 0), 0);
      this.summary.totalPending = rows
        .filter(r => (r.payoutStatus === 'pending' || r.payoutStatus === 'processing') && r.recipientRole === 'influencer')
        .reduce((s, r) => s + Number(r.recipientPayout || 0), 0);
    } else {
      this.summary.totalPaid = rows
        .filter(r => r.collectionStatus === 'verified')
        .reduce((s, r) => s + Number(r.payerTotal || 0), 0);
      this.summary.totalPending = rows
        .filter(r => r.collectionStatus === 'awaiting_payment' || r.collectionStatus === 'proof_submitted')
        .reduce((s, r) => s + Number(r.payerTotal || 0), 0);
    }
  }

  formatPaise(paise: number): string {
    return `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  typeLabel(tx: any): string {
    if (tx.transactionType === 'paid_collab') return 'Paid Collab';
    if (tx.transactionType === 'pay_to_join') return 'Pay-to-Join';
    return tx.transactionType || '—';
  }

  statusLabel(tx: any): string {
    if (this.isInfluencer) {
      if (tx.payoutStatus === 'paid') return 'Received';
      if (tx.payoutStatus === 'processing') return 'Processing';
      if (tx.collectionStatus === 'verified') return 'Awaiting Payout';
      if (tx.collectionStatus === 'proof_submitted') return 'Payment Under Review';
      return 'Awaiting Brand Payment';
    } else {
      if (tx.collectionStatus === 'verified') return 'Payment Verified';
      if (tx.collectionStatus === 'proof_submitted') return 'Proof Under Review';
      if (tx.collectionStatus === 'failed') return 'Payment Rejected';
      return 'Awaiting Payment';
    }
  }

  statusClass(tx: any): string {
    const s = tx.payoutStatus;
    const c = tx.collectionStatus;
    if (s === 'paid' || c === 'verified') return 'status--green';
    if (s === 'processing' || c === 'proof_submitted') return 'status--blue';
    if (c === 'failed') return 'status--red';
    return 'status--amber';
  }

  /** Amount shown from the current user's perspective */
  amountDisplay(tx: any): string {
    if (this.isInfluencer) return '+' + this.formatPaise(tx.recipientPayout);
    return '-' + this.formatPaise(tx.payerTotal);
  }

  setTab(tab: 'pending' | 'completed') {
    this.activeTab = tab;
  }
}
