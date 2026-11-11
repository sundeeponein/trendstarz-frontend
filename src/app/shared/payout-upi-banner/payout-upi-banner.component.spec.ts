import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfigService } from '../config.service';
import { PayoutUpiBannerComponent } from './payout-upi-banner.component';

describe('PayoutUpiBannerComponent (UPI ask after sign-in)', () => {
  const render = (upiId: string) => {
    sessionStorage.removeItem('tsz_upi_prompt_later');
    const config = jasmine.createSpyObj<ConfigService>('ConfigService', ['savePayoutDetails']);
    config.savePayoutDetails.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [PayoutUpiBannerComponent],
      providers: [{ provide: ConfigService, useValue: config }],
    });
    const fixture = TestBed.createComponent(PayoutUpiBannerComponent);
    fixture.componentInstance.role = 'influencer';
    fixture.componentInstance.payout = { upiId, mobile: '9876543210', accountHolderName: 'Ravi' };
    fixture.componentInstance.ready = true;
    fixture.detectChanges();
    return { fixture, config, el: fixture.nativeElement as HTMLElement };
  };

  it('asks creators without a UPI ID, and saves a valid one (keeping their mobile)', () => {
    const { fixture, config, el } = render('');
    expect(el.textContent).toContain('Add your UPI ID to get paid');
    fixture.componentInstance.upiId = 'Ravi@YBL';
    fixture.componentInstance.save();
    fixture.detectChanges();
    expect(config.savePayoutDetails).toHaveBeenCalledWith('influencer', {
      upiId: 'ravi@ybl',
      mobile: '9876543210',
      accountHolderName: 'Ravi',
    });
    expect(el.textContent).not.toContain('Add your UPI ID to get paid');
  });

  it('refuses a mistyped UPI ID without saving', () => {
    const { fixture, config } = render('');
    fixture.componentInstance.upiId = '9876543210';
    fixture.componentInstance.save();
    expect(config.savePayoutDetails).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain("doesn't look right");
  });

  it('asks to fix a saved UPI ID that is wrong, and stays quiet for a valid one', () => {
    expect(render('ravi@').el.textContent).toContain('Please fix your UPI ID');
    TestBed.resetTestingModule();
    expect(render('ravi@ybl').el.textContent?.trim()).toBe('');
  });
});
