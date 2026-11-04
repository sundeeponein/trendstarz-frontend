import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfigService } from '../config.service';
import { ClosureQuestionComponent } from './closure-question.component';

describe('ClosureQuestionComponent (private "what happened?")', () => {
  let config: jasmine.SpyObj<ConfigService>;
  const render = (role: 'creator' | 'host') => {
    config = jasmine.createSpyObj<ConfigService>('ConfigService', ['submitClosureAnswer']);
    config.submitClosureAnswer.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [ClosureQuestionComponent],
      providers: [{ provide: ConfigService, useValue: config }],
    });
    const fixture = TestBed.createComponent(ClosureQuestionComponent);
    fixture.componentInstance.inviteId = 'inv1';
    fixture.componentInstance.role = role;
    fixture.detectChanges();
    return fixture;
  };
  const pick = (el: HTMLElement, label: string) => {
    const option = Array.from(el.querySelectorAll('label.cq-option')).find((l) =>
      l.textContent!.includes(label),
    ) as HTMLElement;
    (option.querySelector('input') as HTMLInputElement).click();
  };

  it('creator can say the host asked them not to post; it is sent privately', async () => {
    const fixture = render('creator');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('only TrendStarZ sees your answer');
    pick(el, 'The host asked me not to post');
    fixture.detectChanges();
    await fixture.whenStable();
    (el.querySelector('button') as HTMLElement).click();
    fixture.detectChanges();
    expect(config.submitClosureAnswer).toHaveBeenCalledWith('inv1', {
      answer: 'host_asked_not_to_post',
      details: undefined,
      link: undefined,
    });
    expect(el.textContent).toContain('TrendStarZ will review it');
  });

  it('host "I saw a post" needs the post link before sending', async () => {
    const fixture = render('host');
    const el = fixture.nativeElement as HTMLElement;
    pick(el, 'I saw a post');
    fixture.detectChanges();
    await fixture.whenStable();
    const send = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Send')) as HTMLButtonElement;
    expect(send().disabled).toBeTrue();
    const link = el.querySelector('input[type="url"]') as HTMLInputElement;
    link.value = 'https://www.instagram.com/reel/x';
    link.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(send().disabled).toBeFalse();
  });
});
