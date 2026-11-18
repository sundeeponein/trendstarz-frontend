import { TestBed } from '@angular/core/testing';
import { YoutubeCheckNoteComponent } from './youtube-check-note.component';
import { YoutubeCheck } from './youtube-check.util';

describe('YoutubeCheckNoteComponent', () => {
  const check = (over: Partial<YoutubeCheck>): YoutubeCheck => ({
    socialAccountId: 'a1',
    platform: 'YouTube',
    subscribers: 1050,
    capturedAt: '2026-10-09T00:00:00.000Z',
    tier: 'Micro',
    declaredTier: 'Micro',
    status: 'matches',
    tierAutoUpdatedAt: null,
    ...over,
  });
  const render = (c: YoutubeCheck | null) => {
    const fixture = TestBed.createComponent(YoutubeCheckNoteComponent);
    fixture.componentInstance.check = c;
    fixture.detectChanges();
    return ((fixture.nativeElement as HTMLElement).textContent || '').replace(/\s+/g, ' ').trim();
  };

  beforeEach(() => TestBed.configureTestingModule({ imports: [YoutubeCheckNoteComponent] }));

  it('matches: just the count and tier', () => {
    expect(render(check({}))).toBe('TrendStarZ checked your channel: 1,050 subscribers on 9 Oct 2026 → Micro tier.');
  });

  it('please_update: asks the creator to update their tier', () => {
    const text = render(check({ declaredTier: 'Nano', status: 'please_update' }));
    expect(text).toContain('1,050 subscribers on 9 Oct 2026 → Micro tier.');
    expect(text).toContain('Your profile says Nano — please update your tier.');
  });

  it('check_handle: no count from another channel, asks to check the handle', () => {
    const text = render(check({ status: 'check_handle' }));
    expect(text).toBe("The YouTube channel we found doesn't match your handle — please check your YouTube handle.");
    expect(text).not.toContain('1,050');
  });

  it('nothing without a check', () => {
    expect(render(null)).toBe('');
  });

  it('handle_renamed: shows the count and asks to update the handle to the new one', () => {
    const text = render(check({ status: 'handle_renamed', newHandle: 'chan_new', handle: '@chan' }));
    expect(text).toContain('1,050 subscribers on 9 Oct 2026 → Micro tier.');
    expect(text).toContain('handle seems to have changed to @chan_new on YouTube — please update your YouTube handle here.');
  });

  it('not_found: names the handle and asks to check it, no count', () => {
    const text = render(check({ status: 'not_found', handle: 'chan', subscribers: null, capturedAt: null, tier: null }));
    expect(text).toBe("We couldn't find your YouTube channel @chan — please check your YouTube handle.");
  });
});
