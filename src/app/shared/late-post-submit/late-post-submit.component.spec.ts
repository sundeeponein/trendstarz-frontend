import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfigService } from '../config.service';
import { LatePostSubmitComponent, LatePostWindow } from './late-post-submit.component';

describe('LatePostSubmitComponent', () => {
  let config: jasmine.SpyObj<ConfigService>;
  const render = (window: LatePostWindow) => {
    config = jasmine.createSpyObj<ConfigService>('ConfigService', ['submitLatePost']);
    config.submitLatePost.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [LatePostSubmitComponent],
      providers: [{ provide: ConfigService, useValue: config }],
    });
    const fixture = TestBed.createComponent(LatePostSubmitComponent);
    fixture.componentInstance.inviteId = 'inv1';
    fixture.componentInstance.window = window;
    fixture.detectChanges();
    return fixture;
  };
  const open: LatePostWindow = {
    canSubmit: true,
    until: '2026-10-17T10:00:00.000Z',
    status: null,
    url: null,
    reviewNote: null,
  };

  it('submits a link for review and then shows it is waiting', () => {
    const fixture = render(open);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Submit the link by');
    const input = el.querySelector('input[type="url"]') as HTMLInputElement;
    input.value = 'https://www.instagram.com/reel/abc';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('button') as HTMLElement).click();
    fixture.detectChanges();
    expect(config.submitLatePost).toHaveBeenCalledWith('inv1', 'https://www.instagram.com/reel/abc', undefined);
    expect(el.textContent).toContain('with TrendStarZ for review');
  });

  it('shows a rejection reason and allows one more try while the window is open', () => {
    const el = render({ ...open, status: 'rejected', reviewNote: 'Different brand' }).nativeElement as HTMLElement;
    expect(el.textContent).toContain('not approved: Different brand');
    expect(el.querySelector('input')).not.toBeNull();
  });

  it('no form once the window has closed', () => {
    const el = render({ ...open, canSubmit: false }).nativeElement as HTMLElement;
    expect(el.querySelector('input')).toBeNull();
  });
});
