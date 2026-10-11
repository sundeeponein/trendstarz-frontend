import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ConfigService } from '../../config.service';
import { ProfileSocialPlatformsComponent } from './profile-social-platforms.component';

describe('ProfileSocialPlatformsComponent — "Link not working?"', () => {
  const render = (linkStatus: Record<string, any> = {}) => {
    const config = jasmine.createSpyObj<ConfigService>('ConfigService', ['reportSocialLink']);
    config.reportSocialLink.and.returnValue(of({ success: true }));
    TestBed.configureTestingModule({
      imports: [ProfileSocialPlatformsComponent],
      providers: [{ provide: ConfigService, useValue: config }],
    });
    const fixture = TestBed.createComponent(ProfileSocialPlatformsComponent);
    Object.assign(fixture.componentInstance, {
      variant: 'influencer',
      platforms: [{ socialAccountId: 'acc1', platform: 'Instagram', handle: 'asha', tier: 'Nano' }],
      canOpen: true,
      reportProfileType: 'Influencer',
      reportProfileId: 'p1',
      linkStatus,
    });
    fixture.detectChanges();
    return { fixture, config };
  };

  it('a signed-in viewer can report a link once, then sees a thank-you', () => {
    const { fixture, config } = render();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.link-report-btn') as HTMLElement).click();
    fixture.detectChanges();
    expect(config.reportSocialLink).toHaveBeenCalledWith('Influencer', 'p1', 'acc1');
    expect(el.textContent).toContain("asked the creator to update it");
    expect(el.querySelector('.link-report-btn')).toBeNull();
  });

  it('a reported link shows "may be outdated" instead of the button', () => {
    const { fixture } = render({ acc1: { status: 'open', since: '2026-10-10' } });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Link may be outdated');
    expect(el.querySelector('.link-report-btn')).toBeNull();
  });
});
