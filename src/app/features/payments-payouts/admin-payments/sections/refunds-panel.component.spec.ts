import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PaymentsPayoutsApiService } from '../../payments-payouts-api.service';
import { RefundQueueItem } from '../../payments-payouts.models';
import { RefundsPanelComponent } from './refunds-panel.component';

const base: RefundQueueItem = {
  _id: 'tx1',
  state: 'owed',
  campaignId: 'c1',
  campaignTitle: 'Diwali Reels',
  campaignNumber: 24,
  inviteId: 'inv1',
  inviteStatus: 'withdrawn',
  hostName: 'Acme',
  hostRole: 'brand',
  creatorName: 'Asha',
  creatorRole: 'influencer',
  creatorSocial: [{ platform: 'Instagram', handle: 'asha.creates' }],
  agreedAmount: 50000,
  platformFee: 5000,
  payerTotal: 55000,
  openReport: false,
  flags: [],
  history: [],
};

describe('RefundsPanelComponent (Admin → Payments → Refunds)', () => {
  let api: jasmine.SpyObj<PaymentsPayoutsApiService>;

  const render = (rows: RefundQueueItem[]) => {
    api = jasmine.createSpyObj<PaymentsPayoutsApiService>('PaymentsPayoutsApiService', [
      'listRefunds',
      'getSummary',
      'markRefundSent',
      'recordHostRepayment',
      'approveSettlementException',
      'reviewLatePost',
      'approveFeeCredit',
      'withholdFeeCredit',
      'excuseMiss',
      'restoreSlot',
    ]);
    api.approveFeeCredit.and.returnValue(of({ success: true }));
    api.excuseMiss.and.returnValue(of({ success: true }));
    api.listRefunds.and.returnValue(of({ success: true, data: rows }));
    api.getSummary.and.returnValue(of({ data: { refundOnHold: 55000, refundDue: 55000, refunded: 0 } }));
    api.markRefundSent.and.returnValue(of({ success: true }));
    api.reviewLatePost.and.returnValue(of({ success: true }));
    api.recordHostRepayment.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [RefundsPanelComponent],
      providers: [{ provide: PaymentsPayoutsApiService, useValue: api }],
    });
    const fixture = TestBed.createComponent(RefundsPanelComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');
  const buttons = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).map((b) => b.textContent!.trim());

  it('shows each money state, the creator links and the risk flags', () => {
    const fixture = render([
      { ...base, flags: ['repeat_pair'] },
      { ...base, _id: 'tx2', state: 'legacy_unconfirmed' },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('Owed');
    expect(text(el)).toContain('Legacy — unconfirmed');
    expect(text(el)).toContain('Same host & creator refunded before');
    expect(text(el)).toContain('Left unchanged until the legacy migration is approved');
    const link = el.querySelector('a.rf-link') as HTMLAnchorElement;
    expect(link.href).toContain('instagram.com/asha.creates');
  });

  it('owed → "Mark refund sent" records UTR and amount in paise', () => {
    const fixture = render([base]);
    const el = fixture.nativeElement as HTMLElement;
    const cmp = fixture.componentInstance;
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Mark refund sent')) as HTMLElement).click();
    fixture.detectChanges();
    cmp.form.utr = 'UTR123';
    cmp.form.amountRupees = '550';
    cmp.submitAction();
    expect(api.markRefundSent).toHaveBeenCalledWith(
      'tx1',
      jasmine.objectContaining({ refundUtr: 'UTR123', refundAmount: 55000 }),
    );
  });

  it('no money buttons while a report is open, a hold is running, or for legacy rows', () => {
    const fixture = render([
      { ...base, openReport: true, reportCategory: 'offplatform' },
      { ...base, _id: 'h', state: 'on_hold', refundHoldUntil: new Date(Date.now() + 86400000).toISOString() },
      { ...base, _id: 'l', state: 'legacy_unconfirmed' },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    expect(buttons(el)).not.toContain('Mark refund sent');
    expect(text(el)).toContain('Off-platform report open');
    expect(text(el)).toContain('Under review until');
  });

  it('late post: approve needs a note of 10+ characters and sends the verified link', () => {
    const fixture = render([
      { ...base, state: 'on_hold', latePost: { status: 'pending', url: 'https://www.instagram.com/reel/x' } },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    const cmp = fixture.componentInstance;
    expect(buttons(el)).toContain('Approve late post');
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Approve late post')) as HTMLElement).click();
    fixture.detectChanges();
    expect(cmp.form.postUrl).toBe('https://www.instagram.com/reel/x');
    cmp.form.note = 'short';
    expect(cmp.actionValid).toBeFalse();
    cmp.form.note = 'Reel is public and tags the brand';
    expect(cmp.actionValid).toBeTrue();
    cmp.submitAction();
    expect(api.reviewLatePost).toHaveBeenCalledWith('inv1', {
      action: 'approve',
      note: 'Reel is public and tags the brand',
      postUrl: 'https://www.instagram.com/reel/x',
    });
  });

  it('settlement offers host repayment / exception, and shows server errors', () => {
    const fixture = render([
      { ...base, state: 'settlement', settlement: { status: 'awaiting_host_repayment', amount: 55000 } },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    const cmp = fixture.componentInstance;
    expect(buttons(el)).toEqual(jasmine.arrayContaining(['Host repaid', 'Pay as exception']));
    const errors: string[] = [];
    cmp.errorMessage.subscribe((m) => errors.push(m));
    api.recordHostRepayment.and.returnValue(throwError(() => ({ error: { message: 'The host must repay ₹550' } })));
    cmp.openAction('repaid', cmp.rows[0]);
    cmp.form.utr = 'HR1';
    cmp.submitAction();
    expect(errors).toEqual(['The host must repay ₹550']);
  });

  it('shows private answers, the new flags and fee-credit review actions', () => {
    const fixture = render([
      {
        ...base,
        state: 'sent',
        refundPolicy: 'fee_credit',
        feeCreditAmount: 5000,
        feeCredit: { status: 'needs_review', amount: 5000 },
        flags: ['replaced_after_no_post', 'host_no_post_rate'],
        closureAnswers: { creator: { answer: 'host_asked_not_to_post', details: 'Asked on WhatsApp' } },
      },
    ]);
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('Host invited another creator within 7 days');
    expect(text(el)).toContain('Host: 2+ no-posts in last 5 paid collaborations');
    expect(text(el)).toContain('Creator: Host asked me not to post');
    expect(text(el)).toContain('Fee credit waiting for review');
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Issue fee credit')) as HTMLElement).click();
    expect(api.approveFeeCredit).toHaveBeenCalledWith('tx1');
  });

  it('"Don\'t count against creator" needs a reason', () => {
    const fixture = render([base]);
    const cmp = fixture.componentInstance;
    cmp.openAction('excuse', cmp.rows[0]);
    cmp.form.note = 'short';
    expect(cmp.actionValid).toBeFalse();
    cmp.form.note = 'Host told the creator not to post';
    cmp.submitAction();
    expect(api.excuseMiss).toHaveBeenCalledWith('inv1', 'Host told the creator not to post');
  });
});
