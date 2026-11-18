import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfigService } from './config.service';
import { ReportedLinksBannerComponent } from './reported-links-banner.component';

describe('ReportedLinksBannerComponent (2026-11-16)', () => {
  const render = (accounts: any[], showEdit = true) => {
    TestBed.configureTestingModule({
      imports: [ReportedLinksBannerComponent],
      providers: [provideRouter([]), { provide: ConfigService, useValue: { getMyReportedLinks: () => of({ accounts }) } }],
    });
    const fixture = TestBed.createComponent(ReportedLinksBannerComponent);
    fixture.componentInstance.showEdit = showEdit;
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).innerText.replace(/\s+/g, ' ');
  };

  it('shows each reported link and the fix, until there are none', () => {
    const text = render([
      { platform: 'Instagram', handle: 'rebuildwithsundeep', status: 'open', since: '2026-11-15T10:00:00Z' },
    ]);
    expect(text).toContain("Hosts can't open one of your links");
    expect(text).toContain('Instagram');
    expect(text).toContain('@rebuildwithsundeep');
    expect(text).toContain('reported by hosts on 15 Nov');
    expect(text).toContain('Update my accounts');
  });

  it('says when TrendStarZ confirmed it, and hides the button on the profile page', () => {
    const text = render([{ platform: 'YouTube', handle: 'x', status: 'confirmed', since: null }], false);
    expect(text).toContain('checked by TrendStarZ: it does not open');
    expect(text).not.toContain('Update my accounts');
  });

  it('shows nothing when no link is reported', () => {
    expect(render([]).trim()).toBe('');
  });
});
