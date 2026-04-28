import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PremiumPaymentsAdminApiService } from '../../premium-payments-admin-api.service';
import { PremiumPaymentsPanelComponent } from './premium-payments-panel.component';

describe('PremiumPaymentsPanelComponent', () => {
  let serviceSpy: jasmine.SpyObj<PremiumPaymentsAdminApiService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<PremiumPaymentsAdminApiService>('PremiumPaymentsAdminApiService', [
      'listPending',
      'listByStatus',
      'approvePayment',
      'rejectPayment',
    ]);

    serviceSpy.listPending.and.returnValue(of({ success: true, payments: [], total: 0, page: 1, pages: 1 }));
    serviceSpy.listByStatus.and.returnValue(of({ payments: [] }));
    serviceSpy.approvePayment.and.returnValue(of({ message: 'ok' }));
    serviceSpy.rejectPayment.and.returnValue(of({ message: 'rejected' }));

    localStorage.setItem('token', 'token');

    await TestBed.configureTestingModule({
      imports: [PremiumPaymentsPanelComponent],
      providers: [
        { provide: PremiumPaymentsAdminApiService, useValue: serviceSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  it('creates and loads premium payment lists on init', () => {
    const fixture = TestBed.createComponent(PremiumPaymentsPanelComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect(serviceSpy.listPending).toHaveBeenCalled();
    expect(serviceSpy.listByStatus).toHaveBeenCalledTimes(2);
  });

  it('emits error when pending load fails', () => {
    serviceSpy.listPending.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    const fixture = TestBed.createComponent(PremiumPaymentsPanelComponent);
    const component = fixture.componentInstance;
    const emitSpy = spyOn(component.errorMessage, 'emit');

    component.loadPendingPayments();

    expect(emitSpy).toHaveBeenCalledWith('boom');
  });

  it('approves payment and emits success', () => {
    const fixture = TestBed.createComponent(PremiumPaymentsPanelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    spyOn(window, 'confirm').and.returnValue(true);
    const successSpy = spyOn(component.successMessage, 'emit');

    component.approvePayment({
      _id: 'p1',
      userId: { username: 'test' },
      userType: 'Influencer',
      transactionId: 'TX1',
      amount: 100,
      premiumDuration: '1m',
      paymentMethod: 'upi',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    expect(serviceSpy.approvePayment).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith('ok');
  });
});
