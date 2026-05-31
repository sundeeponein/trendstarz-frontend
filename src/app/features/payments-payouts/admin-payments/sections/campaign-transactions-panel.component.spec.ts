import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PaymentsPayoutsApiService } from '../../payments-payouts-api.service';
import { CampaignTransactionsPanelComponent } from './campaign-transactions-panel.component';

describe('CampaignTransactionsPanelComponent', () => {
  let serviceSpy: jasmine.SpyObj<PaymentsPayoutsApiService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<PaymentsPayoutsApiService>('PaymentsPayoutsApiService', [
      'listTransactions',
      'getSummary',
      'verifyTransaction',
      'rejectTransaction',
      'markPaid',
      'runAutoApproveStale',
      'runAutoPayoutSweep',
    ]);

    serviceSpy.listTransactions.and.returnValue(
      of({
        success: true,
        data: [
          {
            _id: 'tx1',
            campaignId: 'c1',
            transactionType: 'paid_collab',
            direction: 'brand_to_influencer',
            payerRole: 'brand',
            recipientRole: 'influencer',
            agreedAmount: 10000,
            platformFee: 1000,
            payerTotal: 11000,
            recipientPayout: 10000,
            collectionStatus: 'proof_submitted',
            payoutStatus: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    serviceSpy.getSummary.and.returnValue(
      of({
        data: {
          collected: 11000,
          fees: 1000,
          pendingPayouts: 10000,
          paidOut: 0,
          netBalance: 1000,
        },
      }),
    );
    serviceSpy.verifyTransaction.and.returnValue(of({ success: true }));
    serviceSpy.rejectTransaction.and.returnValue(of({ success: true }));
    serviceSpy.markPaid.and.returnValue(of({ success: true }));
    serviceSpy.runAutoApproveStale.and.returnValue(of({ autoApprovedCount: 2 }));
    serviceSpy.runAutoPayoutSweep.and.returnValue(
      of({ success: true, processed: 1, queued: 1, skipped: 0, failed: 0 }),
    );

    localStorage.setItem('token', 'token');

    await TestBed.configureTestingModule({
      imports: [CampaignTransactionsPanelComponent],
      providers: [
        { provide: PaymentsPayoutsApiService, useValue: serviceSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  it('creates and loads transactions on init', () => {
    const fixture = TestBed.createComponent(CampaignTransactionsPanelComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
    expect(serviceSpy.listTransactions).toHaveBeenCalled();
    expect(serviceSpy.getSummary).toHaveBeenCalled();
    expect(component.visibleTransactions.length).toBe(1);
  });

  it('verifies transaction and emits success', () => {
    const fixture = TestBed.createComponent(CampaignTransactionsPanelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const successSpy = spyOn(component.successMessage, 'emit');

    component.verifyTransaction(component.campaignTransactions[0]);

    expect(serviceSpy.verifyTransaction).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith('Transaction verified');
  });

  it('runs auto-approve and emits completion message', () => {
    const fixture = TestBed.createComponent(CampaignTransactionsPanelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const successSpy = spyOn(component.successMessage, 'emit');

    component.runAutoApproveStaleSubmissions();

    expect(serviceSpy.runAutoApproveStale).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith('Auto-approval run complete. 2 submission(s) approved.');
  });

  it('runs auto payout sweep and emits summary message', () => {
    const fixture = TestBed.createComponent(CampaignTransactionsPanelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const successSpy = spyOn(component.successMessage, 'emit');

    component.runAutoPayoutSweep();

    expect(serviceSpy.runAutoPayoutSweep).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith(
      'Auto payout complete. Processed: 1, Queued: 1, Skipped: 0, Failed: 0.',
    );
  });
});
