import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfigService } from '../config.service';
import { SocialConfirmBannerComponent } from './social-confirm-banner.component';
import { buildSocialProfileUrl } from '../social-handle.util';

describe('SocialConfirmBannerComponent (90-day check)', () => {
  const render = (due: boolean) => {
    const config = jasmine.createSpyObj<ConfigService>('ConfigService', ['getSocialConfirmStatus', 'confirmSocialAccounts']);
    config.getSocialConfirmStatus.and.returnValue(
      of({ due, accounts: [{ platform: 'YouTube', handle: 'mychannel', platformAccountId: 'UC' + 'a'.repeat(22) }] }),
    );
    config.confirmSocialAccounts.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [SocialConfirmBannerComponent],
      providers: [{ provide: ConfigService, useValue: config }, provideRouter([])],
    });
    const fixture = TestBed.createComponent(SocialConfirmBannerComponent);
    fixture.detectChanges();
    return { fixture, config };
  };

  it('shows the accounts with permanent links and confirms in one click', () => {
    const { fixture, config } = render(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Are these still your accounts?');
    expect((el.querySelector('.scb-list a') as HTMLAnchorElement).href).toContain('youtube.com/channel/UC');
    (el.querySelector('button') as HTMLElement).click();
    fixture.detectChanges();
    expect(config.confirmSocialAccounts).toHaveBeenCalled();
    expect(el.textContent).not.toContain('Are these still your accounts?');
  });

  it('shows nothing when not due', () => {
    const { fixture } = render(false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});

describe('buildSocialProfileUrl with a YouTube channel id', () => {
  it('uses the permanent channel link when known, the handle otherwise', () => {
    expect(buildSocialProfileUrl('YouTube', 'old', 'UC' + 'b'.repeat(22))).toBe('https://www.youtube.com/channel/UC' + 'b'.repeat(22));
    expect(buildSocialProfileUrl('YouTube', 'old', 'not-an-id')).toBe('https://www.youtube.com/@old');
    expect(buildSocialProfileUrl('Instagram', 'asha', 'UC' + 'b'.repeat(22))).toBe('https://instagram.com/asha');
  });
});
