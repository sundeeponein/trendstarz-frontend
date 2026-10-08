import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminUserTableComponent } from '../admin-users-table/admin-user-table.component';
import { TierReviewComponent, TierReviewItem, TierReviewPage } from './tier-review.component';

const item = (over: Partial<TierReviewItem> = {}): TierReviewItem => ({
  reason: 'observed_mismatch',
  since: '2026-10-06T00:00:00.000Z',
  profileType: 'Influencer',
  profileId: 'inf1',
  creatorName: 'Asha',
  username: 'asha',
  socialAccountId: '64b0000000000000000000a1',
  platform: 'YouTube',
  platformKey: 'youtube',
  handle: '@asha',
  declaredTier: 'Micro',
  declaredTierRef: { key: 'micro', label: 'Micro' },
  decision: {
    status: 'pending',
    decidedTier: null,
    decidedAt: null,
    decidedByName: null,
    evidenceBasis: null,
    invalidatedAt: null,
  },
  observed: {
    followers: 50000,
    tier: { key: 'mid_tier', label: 'Mid-Tier' },
    capturedAt: '2026-10-06T00:00:00.000Z',
    freshness: 'fresh',
    requiresConnection: false,
    connected: null,
    lastAttemptFailed: false,
  },
  declaredVsObserved: 'mismatch',
  observedUsable: true,
  ...over,
});

const page = (items: TierReviewItem[]): TierReviewPage => ({
  asOf: '2026-10-08T00:00:00.000Z',
  counts: { changed_since_review: 0, observed_mismatch: 1, never_reviewed: 1 },
  total: 2,
  platforms: { youtube: 1, instagram: 1 },
  filtered: items.length,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  items,
});

describe('TierReviewComponent (Stage 3D-1b)', () => {
  let fixture: ComponentFixture<TierReviewComponent>;
  let http: HttpTestingController;
  // Lower-cased: field labels are styled uppercase.
  const text = () =>
    (fixture.nativeElement as HTMLElement).innerText.replace(/\s+/g, ' ').toLowerCase();
  const queue = () => http.expectOne((r) => r.url.includes('/admin/tier-review'));

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TierReviewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(TierReviewComponent);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const load = (items: TierReviewItem[]) => {
    fixture.detectChanges();
    queue().flush({ success: true, data: page(items) });
    fixture.detectChanges();
  };

  it('shows the declared vs observed evidence and the reason counts', () => {
    load([item()]);
    expect(text()).toContain('observation disagrees 1');
    expect(text()).toContain('never reviewed 1');
    expect(text()).toContain('declared tier micro');
    expect(text()).toContain('50,000 followers → mid-tier');
    expect(text()).toContain('different tier');
  });

  it('verifies through the existing tier route, with the tier the admin saw and the evidence basis', () => {
    load([item()]);
    const c = fixture.componentInstance;
    c.open(c.data!.items[0], 'verified');
    expect(c.draft.basis).toBe('observed'); // a usable observation exists
    c.draft.note = 'Matches channel';
    c.save();
    const req = http.expectOne((r) =>
      r.url.endsWith('/admin/users/influencer/inf1/social-accounts/64b0000000000000000000a1/tier-verification'),
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      status: 'verified',
      note: 'Matches channel',
      expectedTier: 'Micro',
      evidenceBasis: 'observed',
    });
    req.flush({ message: 'Social account review saved' });
    queue().flush({ success: true, data: page([]) }); // the queue reloads
    expect(c.lastDone).toContain('tier verified');
  });

  it('without a usable observation only a manual check is offered', () => {
    load([item({ observedUsable: false, observed: { ...item().observed, freshness: 'expired' } })]);
    const c = fixture.componentInstance;
    c.open(c.data!.items[0], 'rejected');
    fixture.detectChanges();
    expect(c.draft.basis).toBe('manual_check');
    const observedRadio = (fixture.nativeElement as HTMLElement).querySelector(
      'input[value="observed"]',
    ) as HTMLInputElement;
    expect(observedRadio.disabled).toBeTrue();
  });

  it('shows the server message when a decision is refused (e.g. tier changed meanwhile)', () => {
    load([item()]);
    const c = fixture.componentInstance;
    c.open(c.data!.items[0], 'verified');
    c.save();
    http
      .expectOne((r) => r.url.includes('/tier-verification'))
      .flush(
        { message: "This account's declared tier has changed since you loaded it." },
        { status: 409, statusText: 'Conflict' },
      );
    expect(c.decisionError).toContain('declared tier has changed');
    expect(c.deciding).not.toBeNull();
  });

  it('filters by reason through the query string', () => {
    load([item()]);
    fixture.componentInstance.setReason('never_reviewed');
    const req = queue();
    expect(req.request.url).toContain('reason=never_reviewed');
    expect(req.request.url).toContain('page=1');
    req.flush({ success: true, data: page([]) });
  });
});

describe('Admin user table observation label (Stage 3D-1b)', () => {
  const summary = (latest: any) =>
    AdminUserTableComponent.prototype.socialObservationSummary.call(
      { socialObservationByAccount: { a: { observation: { status: 'success', latest } } } },
      { socialAccountId: 'a' },
    );
  const base = { observedHandle: 'chan', source: 'youtube', capturedAt: '2026-10-01T00:00:00.000Z' };

  it('a count cleared by retention is not labelled as hidden by the platform', () => {
    expect(
      summary({ ...base, observedFollowersCount: null, statisticsPurgedAt: '2026-10-07T00:00:00.000Z' }),
    ).toContain('follower count cleared after 30 days');
  });

  it('a count the platform hides is still "followers hidden"', () => {
    expect(summary({ ...base, observedFollowersCount: null })).toContain('followers hidden');
  });
});
