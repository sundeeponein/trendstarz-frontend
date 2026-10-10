import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfigService } from '../config.service';
import { PaidCollabNoticeComponent } from './paid-collab-notice.component';

describe('PaidCollabNoticeComponent', () => {
  let config: jasmine.SpyObj<ConfigService>;

  const render = (inputs: Partial<PaidCollabNoticeComponent>) => {
    config = jasmine.createSpyObj<ConfigService>('ConfigService', ['acceptPaidCollabTerms', 'reportOffPlatform']);
    config.acceptPaidCollabTerms.and.returnValue(of({ success: true }));
    config.reportOffPlatform.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [PaidCollabNoticeComponent],
      providers: [{ provide: ConfigService, useValue: config }],
    });
    const fixture = TestBed.createComponent(PaidCollabNoticeComponent);
    Object.assign(fixture.componentInstance, { inviteId: 'inv1', ...inputs });
    fixture.detectChanges();
    return fixture;
  };
  const click = (el: HTMLElement, label: string) =>
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes(label)) as HTMLElement).click();

  it('a creator who has not agreed can accept the terms once', () => {
    const fixture = render({ role: 'creator', termsAccepted: false });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('only TrendStarZ can cancel it');
    click(el, 'I agree to the terms');
    fixture.detectChanges();
    expect(config.acceptPaidCollabTerms).toHaveBeenCalledWith('inv1');
    expect(el.textContent).not.toContain('I agree to the terms');
  });

  it('hosts never see the agree button (they accepted when paying)', () => {
    const el = render({ role: 'host', termsAccepted: false }).nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('I agree to the terms');
  });

  it('report needs 20+ characters, then shows it was reported', () => {
    const fixture = render({ role: 'host' });
    const el = fixture.nativeElement as HTMLElement;
    click(el, 'Report:');
    fixture.detectChanges();
    const type = (value: string) => {
      const box = el.querySelector('textarea') as HTMLTextAreaElement;
      box.value = value;
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    type('too short');
    expect((Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Send report')) as HTMLButtonElement).disabled).toBeTrue();
    type('Creator asked me to cancel and pay directly on WhatsApp');
    click(el, 'Send report');
    fixture.detectChanges();
    expect(config.reportOffPlatform).toHaveBeenCalledWith('inv1', 'Creator asked me to cancel and pay directly on WhatsApp');
    expect(el.textContent).toContain('Reported — TrendStarZ will review it.');
  });
});
