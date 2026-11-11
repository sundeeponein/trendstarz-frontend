import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PaymentsPayoutsApiService } from '../../../../features/payments-payouts/payments-payouts-api.service';
import { CancelRequestItem } from '../../../../features/payments-payouts/payments-payouts.models';
import { CancelRequestsPanelComponent } from './cancel-requests-panel.component';

const item = (type: 'cancel' | 'pause'): CancelRequestItem => ({
  inviteId: 'inv1',
  status: 'working',
  campaignTitle: 'Diwali Reels',
  campaignNumber: 24,
  hostName: 'Acme',
  creatorName: 'Asha',
  agreedAmount: 50000,
  request: { type, requestedByRole: 'host', reason: 'Brand changed the launch plan', at: '2026-10-10T10:00:00Z', status: 'pending' },
});

describe('CancelRequestsPanelComponent (Admin → Disputes)', () => {
  let api: jasmine.SpyObj<PaymentsPayoutsApiService>;
  const render = (rows: CancelRequestItem[]) => {
    api = jasmine.createSpyObj<PaymentsPayoutsApiService>('PaymentsPayoutsApiService', ['listCancelRequests', 'decideCancelRequest']);
    api.listCancelRequests.and.returnValue(of({ success: true, data: rows }));
    api.decideCancelRequest.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [CancelRequestsPanelComponent],
      providers: [{ provide: PaymentsPayoutsApiService, useValue: api }],
    });
    const fixture = TestBed.createComponent(CancelRequestsPanelComponent);
    fixture.detectChanges();
    return fixture;
  };
  const type = (fixture: any, selector: string, value: string) => {
    const el = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('approve cancel sends the compensation in paise with the reason', async () => {
    const fixture = render([item('cancel')]);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Brand changed the launch plan');
    type(fixture, 'input[type="number"]', '200');
    type(fixture, 'textarea', 'Creator had drafted the reel already');
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Approve cancel')) as HTMLElement).click();
    expect(api.decideCancelRequest).toHaveBeenCalledWith('inv1', {
      decision: 'approve',
      note: 'Creator had drafted the reel already',
      compensation: 20000,
      pauseDays: undefined,
    });
  });

  it('buttons stay disabled until a 10+ character reason is written', async () => {
    const fixture = render([item('pause')]);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const approve = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Approve pause')) as HTMLButtonElement;
    expect(approve().disabled).toBeTrue();
    type(fixture, 'textarea', 'Medical reason accepted');
    expect(approve().disabled).toBeFalse();
  });
});
