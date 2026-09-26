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
  expandedGroups = new Set<string>();

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
  get isPhotographer(): boolean { return this.role === 'photographer'; }
  get isBrand(): boolean { return this.role === 'brand'; }
  get isRecipient(): boolean { return this.isInfluencer || this.isPhotographer; }

  /** Tabs labelling by role */
  get pendingLabel(): string { return 'Pending'; }
  get completedLabel(): string {
    return this.isRecipient ? 'Received' : 'Paid Out';
  }

  get totalRecordsCount(): number {
    return this.groupTransactions(this.transactions).length;
  }

  get pendingTab(): any[] {
    return this.transactions.filter(tx => {
      if (this.isRecipient) {
        // recipient is influencer/photographer; pending = collection verified but payout not yet paid
        return tx.payoutStatus === 'pending' || tx.payoutStatus === 'processing'
          || (tx.collectionStatus !== 'verified' && tx.payoutStatus !== 'paid');
      }
      // brand is the payer; pending = proof not yet verified by admin
      return tx.collectionStatus === 'awaiting_payment' || tx.collectionStatus === 'proof_submitted';
    });
  }

  get completedTab(): any[] {
    return this.transactions.filter(tx => {
      if (this.isRecipient) {
        return tx.payoutStatus === 'paid';
      }
      // brand: collection verified (payment confirmed / accepted by admin)
      return tx.collectionStatus === 'verified';
    });
  }

  get activeRows(): any[] {
    return this.activeTab === 'pending' ? this.pendingTab : this.completedTab;
  }

  get activeGroups(): Array<{ key: string; rows: any[]; primary: any; count: number; totalAmount: number; totalPlatformFee: number; partyNames: string[] }> {
    return this.groupTransactions(this.activeRows);
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
    const payoutProcessingStage = (tx: any) => {
      const inviteStatus = String(tx?.inviteSnapshot?.status || tx?.inviteStatus || '').trim().toLowerCase();
      const workStatus = String(tx?.workStatus || '').trim().toLowerCase();
      return ['completed', 'approved'].includes(inviteStatus) || workStatus === 'approved';
    };

    if (this.isRecipient) {
      this.summary.totalEarned = rows
        .filter(r => r.payoutStatus === 'paid' && (r.recipientRole === 'influencer' || r.recipientRole === 'photographer'))
        .reduce((s, r) => s + Number(r.recipientPayout || 0), 0);
      this.summary.totalPending = rows
        .filter(r =>
          (r.payoutStatus === 'pending' || r.payoutStatus === 'processing') &&
          (r.recipientRole === 'influencer' || r.recipientRole === 'photographer') &&
          payoutProcessingStage(r)
        )
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
    if (this.isRecipient) {
      const inviteStatus = String(tx?.inviteSnapshot?.status || tx?.inviteStatus || '').trim().toLowerCase();
      const workStatus = String(tx?.workStatus || '').trim().toLowerCase();
      const payoutStatus = String(tx?.payoutStatus || '').trim().toLowerCase();
      if (payoutStatus === 'paid') return `Paid ${this.formatPaise(tx.recipientPayout || 0)}`;
      if (payoutStatus === 'processing' || ['completed', 'approved'].includes(inviteStatus) || workStatus === 'approved') return 'Payout Processing (4-6 hrs)';
      if (inviteStatus === 'submitted') return 'Under Review (24 hrs)';
      if (inviteStatus === 'working') return 'Complete your Reel/Post';
      if (inviteStatus === 'payment_confirmed') return 'Ready to Start';
      if (inviteStatus === 'accepted') return 'Waiting for Host Confirmation';
      if (tx.collectionStatus === 'proof_submitted') return 'Payment Under Review';
      if (tx.collectionStatus === 'verified') return 'Ready to Start';
      return 'Waiting for Host Confirmation';
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
    if (this.isRecipient) {
      const label = this.statusLabel(tx).toLowerCase();
      if (label.includes('paid')) return 'status--green';
      if (label.includes('processing') || label.includes('under review') || label.includes('ready')) return 'status--blue';
      if (label.includes('rejected')) return 'status--red';
      return 'status--amber';
    }
    if (s === 'paid' || c === 'verified') return 'status--green';
    if (s === 'processing' || c === 'proof_submitted') return 'status--blue';
    if (c === 'failed') return 'status--red';
    return 'status--amber';
  }

  /** Amount shown from the current user's perspective */
  amountDisplay(tx: any): string {
    if (this.isRecipient) return '+' + this.formatPaise(tx.recipientPayout);
    return '-' + this.formatPaise(tx.payerTotal);
  }

  groupAmountDisplay(group: { totalAmount: number }): string {
    return (this.isRecipient ? '+' : '-') + this.formatPaise(group.totalAmount);
  }

  groupPartyLabel(group: { count: number; partyNames: string[]; primary: any }): string {
    if (this.isRecipient) return group.primary?.otherPartyName || '';
    if (group.count > 1) return `${group.count} recipients`;
    return group.partyNames[0] || group.primary?.otherPartyName || '';
  }

  groupInfluencerNames(group: { partyNames: string[] }): string {
    return group.partyNames.join(', ');
  }

  private groupTransactions(rows: any[]): Array<{ key: string; rows: any[]; primary: any; count: number; totalAmount: number; totalPlatformFee: number; partyNames: string[] }> {
    const groups = new Map<string, { key: string; rows: any[]; primary: any; count: number; totalAmount: number; totalPlatformFee: number; partyNames: string[] }>();

    for (const tx of rows) {
      const key = this.groupKey(tx);
      const amount = this.isRecipient ? Number(tx.recipientPayout || 0) : Number(tx.payerTotal || 0);
      const fee = Number(tx.platformFee || 0);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          rows: [tx],
          primary: tx,
          count: 1,
          totalAmount: amount,
          totalPlatformFee: fee,
          partyNames: tx.otherPartyName ? [tx.otherPartyName] : [],
        });
        continue;
      }

      const g = groups.get(key)!;
      g.rows.push(tx);
      g.count += 1;
      g.totalAmount += amount;
      g.totalPlatformFee += fee;
      if (tx.otherPartyName && !g.partyNames.includes(tx.otherPartyName)) {
        g.partyNames.push(tx.otherPartyName);
      }
    }

    return Array.from(groups.values());
  }

  private groupKey(tx: any): string {
    const batchId = (tx.paymentBatchId || '').trim();
    if (batchId) return `batch:${batchId}`;

    const utr = (tx.utrNumber || '').trim();
    if (utr) return `utr:${tx.campaignId || ''}:${utr}`;

    return `tx:${tx._id || tx.inviteId || tx.createdAt || Math.random()}`;
  }

  setTab(tab: 'pending' | 'completed') {
    this.activeTab = tab;
  }

  toggleGroup(key: string) {
    if (this.expandedGroups.has(key)) {
      this.expandedGroups.delete(key);
    } else {
      this.expandedGroups.add(key);
    }
  }

  isGroupExpanded(key: string): boolean {
    return this.expandedGroups.has(key);
  }

  influencerAmountDisplay(tx: any): string {
    if (this.isRecipient) return '+' + this.formatPaise(tx.recipientPayout);
    return this.formatPaise(tx.recipientPayout);
  }
}
