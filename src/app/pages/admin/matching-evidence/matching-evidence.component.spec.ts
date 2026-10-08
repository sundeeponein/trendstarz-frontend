import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  EvidenceQualityReport,
  MatchingEvidenceComponent,
  PlatformEvidence,
  YoutubeScheduleStatus,
} from './matching-evidence.component';

const platform = (over: Partial<PlatformEvidence> = {}): PlatformEvidence => ({
  accounts: 0,
  requiresConnection: 0,
  connected: 0,
  attempted: 0,
  lastAttemptFailed: 0,
  failureReasons: {},
  freshness: { fresh: 0, stale: 0, expired: 0, never: 0 },
  usableObservedFollowers: 0,
  usableObservedFollowersPct: 0,
  handleConsistency: { match: 0, mismatch: 0, not_available: 0 },
  declaredVsObservedTier: { match: 0, mismatch: 0, not_available: 0 },
  ownership: { verified: 0, rejected: 0, never_reviewed: 0, changed_since_review: 0 },
  tier: { verified: 0, rejected: 0, never_reviewed: 0, changed_since_review: 0 },
  sample: 'sufficient',
  ...over,
});

const report = (): EvidenceQualityReport => ({
  asOf: '2026-10-06T06:00:00.000Z',
  definitions: {
    minSampleSize: 20,
    proposedThresholds: {
      observationFreshDays: 30,
      observationExpiredAfterDays: 90,
      minimumRateRupees: 50,
    },
  },
  population: {
    influencers: { evaluated: 267, approvedActive: 198 },
    photographers: { evaluated: 3, approvedActive: 3 },
  },
  socialEvidence: {
    byPlatform: {
      youtube: platform({
        accounts: 40,
        freshness: { fresh: 3, stale: 1, expired: 0, never: 36 },
        usableObservedFollowers: 4,
        usableObservedFollowersPct: 10,
      }),
      instagram: platform({
        accounts: 195,
        requiresConnection: 195,
        ownership: { verified: 1, rejected: 0, never_reviewed: 194, changed_since_review: 0 },
      }),
      facebook: platform({ accounts: 14, requiresConnection: 14, sample: 'insufficient' }),
    },
    overall: platform({ accounts: 249, usableObservedFollowersPct: 1.6 }),
  },
  creatorData: {
    influencers: {
      creators: 198,
      sample: 'sufficient',
      activity: {
        within_7_days: 4,
        within_8_30_days: 6,
        within_31_90_days: 105,
        over_90_days: 75,
        unknown: 8,
      },
      activityUnknownPct: 4,
      categories: { perCreator: { '1': 22, '5': 84, '6+': 6 }, overCurrentCap: 6, cap: 5 },
      rates: {
        enabledRows: 648,
        pricedRows: 648,
        belowProposedMinimum: 3,
        multipleOf500: 463,
        multipleOf500Pct: 71.5,
        confirmationTracked: false,
      },
      availability: { availableTrue: 178, falseOrUnset: 20, explicitStateTracked: false },
    },
    photographers: {
      creators: 3,
      sample: 'insufficient',
      activity: {},
      activityUnknownPct: 0,
      categories: { perCreator: {}, overCurrentCap: 0, cap: 5 },
      rates: {
        enabledRows: 0,
        pricedRows: 0,
        belowProposedMinimum: 0,
        multipleOf500: 0,
        multipleOf500Pct: null,
        confirmationTracked: false,
      },
      availability: { availableTrue: 3, falseOrUnset: 0, explicitStateTracked: false },
    },
  },
  outcomes: {
    total: 182,
    live: 19,
    backfilled: 163,
    liveCaptureSince: { stage1: '2026-09-29T16:51:36.101Z' },
    byType: {
      invite_accepted: { total: 21, live: 2, backfilled: 19 },
      creator_invited: { total: 49, live: 2, backfilled: 47 },
    },
    approvedCreatorsWithAnyEvent: 35,
    sample: 'insufficient',
  },
  rankingResolution: {
    campaigns: [
      {
        campaignId: 'aaaaaaaaaaaaaaaaaaaa4fb2',
        campaignNumber: null,
        status: 'completed',
        eligible: 170,
        ranked: 170,
        distinctSignalCombinations: 25,
        creatorsInTieGroupsPct: 96.5,
        largestTieGroup: 26,
        decidedPairsPct: { platformContent: 28.5, category: 53, activity: 10.2, creatorId: 8.3 },
        topNCutoffInTie: { top5: false, top10: false, top25: true },
      },
      {
        campaignId: 'c24',
        campaignNumber: 24,
        status: 'active',
        eligible: 145,
        ranked: 145,
        distinctSignalCombinations: 13,
        creatorsInTieGroupsPct: 98.6,
        largestTieGroup: 28,
        decidedPairsPct: { platformContent: 0, category: 71.1, activity: 15.7, creatorId: 13.1 },
        topNCutoffInTie: { top5: true, top10: true, top25: true },
      },
    ],
    overall: {
      campaigns: 17,
      ranked: 2186,
      creatorsInTieGroupsPct: 96.2,
      decidedPairsPct: { platformContent: 19.2, category: 53.6, activity: 14.9, creatorId: 12.3 },
      topNCutoffInTie: {
        top5: { inTie: 14, measurable: 17 },
        top10: { inTie: 13, measurable: 17 },
        top25: { inTie: 11, measurable: 17 },
      },
    },
  },
});

const schedule = (over: Partial<YoutubeScheduleStatus> = {}): YoutubeScheduleStatus => ({
  enabled: false,
  switch: 'YOUTUBE_OBSERVATION_SCHEDULE_ENABLED',
  schedule: { refreshEveryDays: 7, runsAt: '02:30 Asia/Kolkata daily' },
  retention: { maxAgeDays: 30, countsOlderThanLimit: 0 },
  lastScheduledAttemptAt: null,
  candidates: 42,
  dueNow: 42,
  notDue: 0,
  paused: [],
  ...over,
});

describe('MatchingEvidenceComponent (admin, read-only)', () => {
  let fixture: ComponentFixture<MatchingEvidenceComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  // innerText follows layout, so separate elements read as separate words.
  const text = () => el().innerText.replace(/\s+/g, ' ');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatchingEvidenceComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(MatchingEvidenceComponent);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const flush = (r: any = report(), s: any = schedule()) => {
    fixture.detectChanges();
    http
      .expectOne((q) => q.url.endsWith('/admin/matching/evidence-quality'))
      .flush({ success: true, data: r });
    const sched = http.expectOne((q) =>
      q.url.endsWith('/admin/social-observation/youtube-schedule'),
    );
    if (s instanceof Error) sched.flush({ message: s.message }, { status: 500, statusText: 'err' });
    else sched.flush({ success: true, data: s });
    fixture.detectChanges();
  };

  it('only reads (two GETs), and shows population and the as-of time', () => {
    fixture.detectChanges();
    const reqs = [
      http.expectOne((q) => q.url.endsWith('/admin/matching/evidence-quality')),
      http.expectOne((q) => q.url.endsWith('/admin/social-observation/youtube-schedule')),
    ];
    expect(reqs.map((r) => r.request.method)).toEqual(['GET', 'GET']);
    reqs[0].flush({ success: true, data: report() });
    reqs[1].flush({ success: true, data: schedule() });
    fixture.detectChanges();
    // Labels are styled uppercase.
    expect(text()).toContain('APPROVED INFLUENCERS Total 267 198 of 267 creators');
    expect(text()).toContain('As of Oct 6, 2026, 6:00 AM UTC');
  });

  it('per-platform table in a fixed platform order, with small samples flagged', () => {
    flush();
    const rows = Array.from(
      el().querySelectorAll('[data-section="platforms"] tbody tr'),
    ) as HTMLElement[];
    const cells = (r: HTMLElement) =>
      Array.from(r.querySelectorAll('td')).map((td) => td.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows.map((r) => cells(r)[0])).toEqual(['Instagram', 'YouTube', 'Facebook small sample']);
    // Instagram: 195 accounts, all need a connection, 0 connected, 0 observed, 1 ownership verified.
    expect(cells(rows[0])).toEqual(['Instagram', '195', '195', '0', '0', '0 (0%)', '1', '0']);
    // YouTube needs no connection ("—"), observed = fresh + stale.
    expect(cells(rows[1])).toEqual(['YouTube', '40', '0', '—', '4', '4 (10%)', '0', '0']);
  });

  it('shows the schedule switch, scope and retention', () => {
    flush();
    expect(text()).toContain('Scheduled observation: Off');
    expect(text()).toContain('Accounts in scope 42');
    expect(text()).toContain('Counts older than 30 days 0');
    expect(text()).toContain('YOUTUBE_OBSERVATION_SCHEDULE_ENABLED');
  });

  it('a schedule error never hides the evidence report', () => {
    flush(report(), new Error('boom'));
    expect(text()).toContain('boom');
    expect(text()).toContain('SOCIAL EVIDENCE BY PLATFORM');
  });

  it('highlights the busiest activity window, categories over the cap and a low observed coverage', () => {
    flush();
    const rowText = (cls: string) =>
      Array.from(el().querySelectorAll(`[data-section="creators"] tr.${cls}`)).map((r) =>
        (r as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      );
    expect(rowText('adm-row--warn')).toEqual(['31–90 days 105']);
    expect(rowText('adm-row--danger')).toEqual(['6+ categories 6']);
    // 1.6% of accounts have a usable count → flagged.
    expect(text()).toContain('Low coverage');
  });

  it('creator data, events and ranking resolution come straight from the report', () => {
    flush();
    expect(text()).toContain('More than 90 days 75');
    expect(text()).toContain('Multiples of ₹500 463 (71.5%)');
    expect(text()).toContain("can't be told apart yet");
    expect(text()).toContain('Captured live 19');
    expect(text()).toContain('CREATOR ID TIE-BREAK 12.3%');
    expect(text()).toContain('Top-5 cutoff inside a tie: 14 of 17');
    expect(text()).toContain('CMP-24');
    expect(text()).toContain('…4fb2');
    expect(text()).not.toMatch(/match score|ai score|\d+\s*\/\s*100/i);
  });

  it('shows the backend error message (and drops the schedule request)', () => {
    fixture.detectChanges();
    const sched = http.expectOne((q) =>
      q.url.endsWith('/admin/social-observation/youtube-schedule'),
    );
    http
      .expectOne((q) => q.url.endsWith('/admin/matching/evidence-quality'))
      .flush({ message: 'Forbidden resource' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(sched.cancelled).toBe(true);
    expect(text()).toContain('Forbidden resource');
  });
});
