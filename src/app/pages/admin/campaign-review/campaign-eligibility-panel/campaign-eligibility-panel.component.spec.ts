import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  CampaignEligibilityList,
  CampaignEligibilityPanelComponent,
  CampaignEligibilityRow,
} from './campaign-eligibility-panel.component';

const req = (status: 'PASS' | 'FAIL' | 'UNKNOWN', reason = 'ok', configured = true) => ({
  status,
  reason,
  configured,
});

const row = (over: Partial<CampaignEligibilityRow> = {}): CampaignEligibilityRow => ({
  creatorId: 'c1',
  creatorType: 'Influencer',
  name: 'Asha',
  username: 'asha',
  publicId: 'TSZ-1',
  overall: 'PASS',
  requirements: {
    accountApproval: req('PASS'),
    creatorType: req('PASS'),
    platformContent: req('PASS'),
    category: req('PASS'),
    minimumTier: req('PASS'),
    location: req('PASS'),
    language: req('PASS', 'No language requirement.', false),
  },
  invited: false,
  invitable: true,
  inviteBlockedReason: null,
  ...over,
});

const list = (rows: CampaignEligibilityRow[], status = 'active'): CampaignEligibilityList => {
  const counts = { PASS: 1, UNKNOWN: 0, FAIL: 1 };
  const rc = { PASS: 2, UNKNOWN: 0, FAIL: 0, configured: true };
  return {
    campaign: {
      campaignId: 'camp-1',
      title: 'Diwali Reels',
      status,
      invitesOpen: status === 'active',
      invitesClosedReason:
        status === 'active' ? null : 'Invites can only be sent for live (approved) campaigns.',
      recipientRole: 'influencer',
      ownerType: 'brand',
      requirements: {
        platforms: ['instagram'],
        contentTypes: ['instagram:reel'],
        categories: ['Fashion'],
        targetCreatorCategories: [],
        minimumTier: 'Micro',
        location: { state: 'Telangana', district: 'Hyderabad' },
        languages: [],
      },
    },
    scope: { creatorType: 'Influencer', evaluated: 2, alreadyInvited: 1 },
    counts,
    requirementCounts: {
      accountApproval: rc,
      creatorType: rc,
      platformContent: rc,
      category: rc,
      minimumTier: rc,
      location: { ...rc, PASS: 1, FAIL: 1 },
      language: { ...rc, configured: false },
    },
    total: rows.length,
    rows,
    notEvaluated: [{ input: 'budget', reason: 'Different units.' }],
  };
};

describe('CampaignEligibilityPanelComponent (Stage 3B-3)', () => {
  let fixture: ComponentFixture<CampaignEligibilityPanelComponent>;
  let component: CampaignEligibilityPanelComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CampaignEligibilityPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(CampaignEligibilityPanelComponent);
    component = fixture.componentInstance;
    component.campaignId = 'camp-1';
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const expectLoad = () =>
    http.expectOne((r) => r.url.includes('/admin/matching/eligibility/camp-1?'));

  it('requests PASS + UNKNOWN by default and unwraps the {success, data} envelope', () => {
    fixture.detectChanges();
    const r = expectLoad();
    expect(r.request.method).toBe('GET');
    const params = new URLSearchParams(r.request.url.split('?')[1]);
    expect(params.get('status')).toBe('PASS,UNKNOWN');
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('25');
    expect(params.has('requirement')).toBeFalse();
    r.flush({ success: true, data: list([row()]) });
    fixture.detectChanges();

    expect(component.data?.counts.FAIL).toBe(1);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Asha');
    expect(text).toContain('Micro or above');
    expect(text).toContain('Hyderabad, Telangana');
  });

  it('shows the reason for every requirement the creator does not pass', () => {
    fixture.detectChanges();
    const failing = row({
      creatorId: 'c2',
      name: 'Ravi',
      overall: 'FAIL',
      requirements: {
        ...row().requirements,
        location: req('FAIL', 'Creator state Kerala does not match Telangana.'),
      },
    });
    expectLoad().flush({ success: true, data: list([failing]) });
    fixture.detectChanges();

    const reasons = fixture.nativeElement.querySelectorAll('.ce-reasons li');
    expect(reasons.length).toBe(1);
    expect(reasons[0].textContent).toContain('Location:');
    expect(reasons[0].textContent).toContain('Kerala');
    expect(fixture.nativeElement.querySelector('.ce-chip--unset')).not.toBeNull();
  });

  it('toggling groups, requirement filter and search reload page 1 with the new query', fakeAsync(() => {
    fixture.detectChanges();
    expectLoad().flush({ success: true, data: list([row()]) });

    component.currentPage = 3;
    component.toggleStatus('FAIL');
    let params = new URLSearchParams(expectLoad().request.url.split('?')[1]);
    expect(params.get('status')).toBe('PASS,UNKNOWN,FAIL');
    expect(params.get('page')).toBe('1');

    component.requirementFilter = 'location';
    component.onRequirementFilterChange();
    params = new URLSearchParams(expectLoad().request.url.split('?')[1]);
    expect(params.get('requirement')).toBe('location');

    component.searchQuery = ' ravi ';
    component.onSearchChange();
    tick(300);
    params = new URLSearchParams(expectLoad().request.url.split('?')[1]);
    expect(params.get('q')).toBe('ravi');
  }));

  it('never deselects the last group', () => {
    fixture.detectChanges();
    expectLoad().flush({ success: true, data: list([]) });
    component.toggleStatus('PASS');
    expectLoad().flush({ success: true, data: list([]) });
    component.toggleStatus('UNKNOWN');
    http.expectNone((r) => r.url.includes('/admin/matching/eligibility/'));
    expect([...component.selectedStatuses]).toEqual(['UNKNOWN']);
  });

  it('shows the backend error message', () => {
    fixture.detectChanges();
    expectLoad().flush({ message: 'Campaign not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Campaign not found');
  });

  describe('Stage 3B-4 invites', () => {
    const rows = () => [
      row({ creatorId: 'p1', name: 'Asha' }),
      row({
        creatorId: 'p2',
        name: 'Bala',
        invited: true,
        invitable: false,
        inviteBlockedReason: 'Already invited to this campaign.',
      }),
      row({
        creatorId: 'u1',
        name: 'Chitra',
        overall: 'UNKNOWN',
        invitable: false,
        inviteBlockedReason: 'Eligibility unknown.',
      }),
      row({ creatorId: 'p3', name: 'Dev' }),
    ];
    const loadWith = (status = 'active') => {
      fixture.detectChanges();
      expectLoad().flush({ success: true, data: list(rows(), status) });
      fixture.detectChanges();
    };
    const expectInvitePost = () =>
      http.expectOne(
        (r) => r.method === 'POST' && r.url.endsWith('/admin/matching/eligibility/camp-1/invites'),
      );

    it('only eligible, not-yet-invited rows are selectable', () => {
      loadWith();
      const boxes: HTMLInputElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.ce-row-check'),
      );
      expect(boxes.map((b) => b.disabled)).toEqual([false, true, true, false]);
      expect(fixture.nativeElement.querySelector('.ce-invited-tag').textContent).toContain(
        'Invited',
      );

      component.toggleSelectPage();
      expect([...component.selected.keys()]).toEqual(['p1', 'p3']);
      component.toggleSelected(component.data!.rows[1]);
      component.toggleSelected(component.data!.rows[2]);
      expect(component.selected.size).toBe(2);
      component.toggleSelectPage();
      expect(component.selected.size).toBe(0);
    });

    it('no selection or invite controls unless the campaign is live', () => {
      loadWith('pending_review');
      expect(component.canInvite).toBeFalse();
      expect(fixture.nativeElement.querySelector('.ce-row-check')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('live (approved) campaigns');
      component.toggleSelected(component.data!.rows[0]);
      expect(component.selected.size).toBe(0);
    });

    it('asks for confirmation, posts the selected ids, shows the outcome and reloads', () => {
      // Real DOM events, as the admin uses it (zoneless: events schedule the refresh).
      const el: HTMLElement = fixture.nativeElement;
      const button = (text: string) =>
        Array.from(el.querySelectorAll('button')).find((b) =>
          (b.textContent || '').includes(text),
        ) as HTMLButtonElement;
      loadWith();
      (el.querySelector('.ce-check input') as HTMLInputElement).click();
      fixture.detectChanges();
      expect(el.querySelector('.ce-invite-count')!.textContent).toContain('2 selected');
      http.expectNone((r) => r.method === 'POST');

      button('Invite selected (2)').click();
      fixture.detectChanges();
      expect(el.querySelector('.ce-confirm')!.textContent).toContain(
        'Send 2 invites on behalf of the campaign owner',
      );
      http.expectNone((r) => r.method === 'POST');

      button('Send invites').click();
      const post = expectInvitePost();
      expect(post.request.body).toEqual({ creatorIds: ['p1', 'p3'] });
      post.flush({
        success: true,
        data: {
          requested: 2,
          invited: [{ creatorId: 'p1', inviteId: 'i1' }],
          skipped: [
            {
              creatorId: 'p3',
              code: 'invite_rejected',
              reason: 'Plan limit: Only 1 invites per campaign allowed.',
            },
          ],
        },
      });
      expectLoad().flush({ success: true, data: list(rows()) });
      fixture.detectChanges();

      expect(component.selected.size).toBe(0);
      const outcome = fixture.nativeElement.querySelector('.ce-outcome').textContent as string;
      expect(outcome).toContain('1 invited');
      expect(outcome).toContain('1 not sent');
      expect(outcome).toContain('Dev:');
      expect(outcome).toContain('Plan limit');
    });

    it('shows the backend error and keeps the selection', () => {
      loadWith();
      component.toggleSelectPage();
      component.sendInvites();
      expectInvitePost().flush(
        { message: 'Invites can only be sent for live (approved) campaigns.' },
        { status: 400, statusText: 'Bad Request' },
      );
      fixture.detectChanges();
      expect(component.selected.size).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('live (approved) campaigns');
    });
  });

  describe('Stage 3B-3 hardening', () => {
    const el = () => fixture.nativeElement as HTMLElement;

    it('Invited and eligibility are shown independently (invited + not eligible stays visible)', () => {
      fixture.detectChanges();
      expectLoad().flush({
        success: true,
        data: list([
          row({
            creatorId: 'x',
            name: 'Ravi',
            overall: 'FAIL',
            invited: true,
            invitable: false,
            inviteBlockedReason: 'Already invited to this campaign.',
            requirements: { ...row().requirements, category: req('FAIL', 'Wrong category.') },
          }),
        ]),
      });
      fixture.detectChanges();
      const r = el().querySelector('.ce-row')!;
      expect(r.querySelector('.ce-invited-tag')!.textContent).toContain('Invited');
      expect(r.querySelector('.ce-pill')!.textContent).toContain('Not eligible');
      expect(r.textContent).toContain('Wrong category.');
      expect((r.querySelector('.ce-row-check') as HTMLInputElement).disabled).toBeTrue();
    });

    it("selection follows the server's invitable flag, not the browser's own reading of PASS", () => {
      fixture.detectChanges();
      expectLoad().flush({
        success: true,
        data: list([
          row({ creatorId: 'ok' }),
          row({ creatorId: 'blocked', invitable: false, inviteBlockedReason: 'Server says no.' }),
        ]),
      });
      fixture.detectChanges();
      const boxes = Array.from(el().querySelectorAll('.ce-row-check')) as HTMLInputElement[];
      expect(boxes.map((b) => b.disabled)).toEqual([false, true]);
      expect(boxes[1].title).toBe('Server says no.');
      component.toggleSelected(component.data!.rows[1]);
      expect(component.selected.has('blocked')).toBeFalse();
    });

    it('"All" selects every group; counts come from the server', () => {
      fixture.detectChanges();
      expectLoad().flush({ success: true, data: list([row()]) });
      fixture.detectChanges();
      const all = el().querySelector('.ce-group--all') as HTMLButtonElement;
      expect(all.textContent).toContain('2');
      expect(all.textContent).toContain('All');
      all.click();
      const params = new URLSearchParams(expectLoad().request.url.split('?')[1]);
      expect(params.get('status')).toBe('PASS,UNKNOWN,FAIL');
    });

    it('explains that "–" means no requirement set, not a failure', () => {
      fixture.detectChanges();
      expectLoad().flush({ success: true, data: list([row()]) });
      fixture.detectChanges();
      expect(el().querySelector('.ce-legend')!.textContent).toContain(
        'no requirement set on this campaign',
      );
      const unset = el().querySelector('.ce-row .ce-chip--unset') as HTMLElement;
      expect(unset.title).toBe('No language requirement.');
    });

    it('stale selections are flagged "needs review" in the outcome', () => {
      fixture.detectChanges();
      expectLoad().flush({ success: true, data: list([row({ creatorId: 'p1', name: 'Asha' })]) });
      fixture.detectChanges();
      (el().querySelector('.ce-check input') as HTMLInputElement).click();
      component.sendInvites();
      http
        .expectOne((r) => r.method === 'POST')
        .flush({
          success: true,
          data: {
            requested: 1,
            invited: [],
            skipped: [
              {
                creatorId: 'p1',
                code: 'not_eligible',
                reason: 'No longer eligible: Wrong category.',
              },
            ],
          },
        });
      expectLoad().flush({ success: true, data: list([]) });
      fixture.detectChanges();
      const outcome = el().querySelector('.ce-outcome')!.textContent as string;
      expect(outcome).toContain('Asha:');
      expect(outcome).toContain('No longer eligible');
      expect(outcome).toContain('needs review');
    });
  });

  describe('Stage 3C-2 ranking visibility (display only)', () => {
    const el = () => fixture.nativeElement as HTMLElement;
    const evidence = (
      pc: [number, number],
      cat: [number, number],
      bucket: string,
      at: string | null,
    ) => ({
      platformContent: {
        matched: ['instagram:reel', 'youtube:shorts'].slice(0, pc[0]),
        total: pc[1],
      },
      category: {
        matched: ['Fashion', 'Travel', 'Food', 'Beauty', 'Tech', 'Fitness'].slice(0, cat[0]),
        total: cat[1],
      },
      activity: {
        bucket: bucket as any,
        lastActiveAt: at,
        daysSinceActive: at ? 3 : null,
      },
    });
    const ranked = (rank: number, over: Partial<CampaignEligibilityRow> = {}) =>
      row({
        rank,
        rankingReasons: [
          'Matches all campaign platform/content options',
          'Matches 5 of 6 campaign categories',
          'Active within the last 7 days',
        ],
        rankingEvidence: evidence([2, 2], [5, 6], 'within_7_days', '2026-10-01T10:00:00.000Z'),
        ...over,
      });
    const unranked = { rank: null, rankingReasons: [], rankingEvidence: null };
    // Server order (PASS → UNKNOWN → FAIL, then name) — deliberately NOT rank order.
    const rows = () => [
      ranked(3, { creatorId: 'p1', name: 'Asha' }),
      ranked(1, {
        creatorId: 'p2',
        name: 'Bala',
        invited: true,
        invitable: false,
        inviteBlockedReason: 'Already invited to this campaign.',
      }),
      ranked(2, { creatorId: 'p3', name: 'Dev' }),
      row({
        creatorId: 'u1',
        name: 'Chitra',
        overall: 'UNKNOWN',
        invitable: false,
        inviteBlockedReason: 'Eligibility unknown.',
        requirements: { ...row().requirements, language: req('UNKNOWN', 'No languages.') },
        ...unranked,
      }),
      row({
        creatorId: 'f1',
        name: 'Esha',
        overall: 'FAIL',
        invitable: false,
        inviteBlockedReason: 'Not eligible.',
        requirements: { ...row().requirements, category: req('FAIL', 'Wrong category.') },
        ...unranked,
      }),
    ];
    const withRanking = (
      r: CampaignEligibilityRow[],
      ranking: CampaignEligibilityList['ranking'] = {
        asOf: '2026-10-04T16:29:34.303Z',
        rankedCount: 3,
        order: ['platform/content', 'category', 'activity', 'creator id'],
      },
      status = 'active',
    ): CampaignEligibilityList => ({ ...list(r, status), ranking });
    const load = (data: CampaignEligibilityList) => {
      fixture.detectChanges();
      expectLoad().flush({ success: true, data });
      fixture.detectChanges();
    };
    const rowEls = () => Array.from(el().querySelectorAll('.ce-row')) as HTMLElement[];
    const rankText = (r: HTMLElement) => r.querySelector('.ce-rank-value')!.textContent!.trim();

    it('PASS rows show their server rank (#1 included); UNKNOWN and FAIL show "—"', () => {
      load(withRanking(rows()));
      expect(rowEls().map(rankText)).toEqual(['#3', '#1', '#2', '—', '—']);
      expect(rowEls()[1].querySelector('.ce-rank')!.getAttribute('aria-label')).toBe('Rank 1');
      for (const r of rowEls().slice(3)) {
        expect(r.querySelector('.ce-rank')!.getAttribute('aria-label')).toBe('Not ranked');
        expect(r.querySelector('.ce-rank-summary')).toBeNull();
        expect(r.querySelector('.ce-rank-details')).toBeNull();
      }
    });

    it('never shows a rank on a non-eligible row, even if one were sent', () => {
      load(withRanking([row({ creatorId: 'f9', overall: 'FAIL', invitable: false, rank: 4 })]));
      expect(rankText(rowEls()[0])).toBe('—');
      expect(component.rankOf(component.data!.rows[0])).toBeNull();
    });

    it('row order is exactly the server order (PASS → UNKNOWN → FAIL), not rank order', () => {
      load(withRanking(rows()));
      expect(rowEls().map((r) => r.querySelector('.ce-name')!.textContent!.trim())).toEqual([
        'Asha',
        'Bala',
        'Dev',
        'Chitra',
        'Esha',
      ]);
      expect(rowEls().map((r) => r.querySelector('.ce-pill')!.textContent!.trim())).toEqual([
        'Eligible',
        'Eligible',
        'Eligible',
        'Unknown',
        'Not eligible',
      ]);
    });

    it('shows a compact evidence line and server reasons + evidence under "Why rank"', () => {
      load(withRanking(rows()));
      const first = rowEls()[0];
      expect(first.querySelector('.ce-rank-summary')!.textContent!.trim()).toBe(
        '2/2 platform · 5/6 categories · active ≤7d',
      );
      const details = first.querySelector('details.ce-rank-details') as HTMLDetailsElement;
      expect(details.open).toBeFalse();
      expect(details.querySelector('summary')!.textContent).toContain('Why rank #3?');
      const reasons = Array.from(details.querySelectorAll('.ce-rank-reasons li')).map((li) =>
        li.textContent!.trim(),
      );
      expect(reasons).toEqual([
        'Matches all campaign platform/content options',
        'Matches 5 of 6 campaign categories',
        'Active within the last 7 days',
      ]);
      const text = (sel: string) =>
        Array.from(details.querySelectorAll(sel)).map((n) =>
          n.textContent!.replace(/\s+/g, ' ').trim(),
        );
      expect(text('.ce-rank-evidence dt')).toEqual([
        'Platform / content',
        'Categories',
        'Activity',
        'Creator ID',
      ]);
      expect(text('.ce-rank-evidence dd')).toEqual([
        '2/2 (instagram · reel, youtube · shorts)',
        '5/6 (Fashion, Travel, Food, Beauty, Tech)',
        'Active within the last 7 days (last active Oct 1, 2026)',
        'Final tie-break only',
      ]);
    });

    it('unknown activity and unconfigured coverage read as neutral, not as failures', () => {
      load(
        withRanking([ranked(1, { rankingEvidence: evidence([0, 0], [0, 0], 'unknown', null) })]),
      );
      const r = rowEls()[0];
      expect(r.querySelector('.ce-rank-summary')!.textContent!.trim()).toBe(
        'none set platform · none set categories · activity unknown',
      );
      expect(r.querySelector('.ce-rank-evidence')!.textContent).toContain(
        'Unknown — treated as neutral',
      );
      expect(r.querySelector('.ce-rank-evidence')!.textContent).not.toContain('last active');
    });

    it('an invited, ranked creator shows both the rank and the Invited tag', () => {
      load(withRanking(rows()));
      const bala = rowEls()[1];
      expect(rankText(bala)).toBe('#1');
      expect(bala.querySelector('.ce-invited-tag')!.textContent).toContain('Invited');
      expect((bala.querySelector('.ce-row-check') as HTMLInputElement).disabled).toBeTrue();
    });

    it('existing requirement chips and open-issue reasons still render', () => {
      load(withRanking(rows()));
      for (const r of rowEls()) expect(r.querySelectorAll('.ce-chip').length).toBe(7);
      expect(rowEls()[3].querySelector('.ce-chip--unknown')).not.toBeNull();
      expect(rowEls()[4].querySelector('.ce-chip--fail')).not.toBeNull();
      expect(rowEls()[4].textContent).toContain('Wrong category.');
      expect(el().querySelector('.ce-legend')).not.toBeNull();
    });

    it('summary shows rankedCount and the server asOf in UTC; help text names what is not used', () => {
      load(withRanking(rows()));
      const summary = el().querySelector('.ce-ranking')!.textContent!.replace(/\s+/g, ' ');
      expect(summary).toContain('Deterministic ranking');
      expect(summary).toContain('3 eligible creators ranked');
      expect(summary).toContain('As of Oct 4, 2026, 4:29 PM UTC');
      expect(summary).toContain('does not use AI, randomness, follower counts, Premium status');
    });

    it('rankedCount 0 shows the empty state and no rank values', () => {
      load(
        withRanking(
          [
            row({
              creatorId: 'u1',
              overall: 'UNKNOWN',
              invitable: false,
              ...unranked,
            }),
          ],
          { asOf: '2026-10-04T16:29:34.303Z', rankedCount: 0, order: [] },
        ),
      );
      expect(el().querySelector('.ce-ranking')!.textContent).toContain(
        'No eligible creators are currently ranked.',
      );
      expect(el().querySelector('.ce-ranking')!.textContent).not.toContain('creators ranked');
      expect(rankText(rowEls()[0])).toBe('—');
    });

    it('a response without ranking (older backend) hides the summary and shows no ranks', () => {
      load(list([row()]));
      expect(el().querySelector('.ce-ranking')).toBeNull();
      expect(rankText(rowEls()[0])).toBe('—');
      expect(el().querySelector('.ce-rank-details')).toBeNull();
    });

    it('no numeric score or AI wording is shown', () => {
      load(withRanking(rows()));
      const text = el().textContent!;
      expect(text).not.toMatch(/\d+\s*\/\s*100|match score|ai score|compatibility|ranking score/i);
    });

    it('filters send the same query as before (no rank/sort parameters)', fakeAsync(() => {
      load(withRanking(rows()));
      component.toggleStatus('FAIL');
      const params = new URLSearchParams(expectLoad().request.url.split('?')[1]);
      expect([...params.keys()].sort()).toEqual(['page', 'pageSize', 'status']);
      expect(params.get('status')).toBe('PASS,UNKNOWN,FAIL');
    }));

    it('loading ranks selects nobody; select-all and the invite payload follow row order and invitable, not rank', () => {
      load(withRanking(rows()));
      expect(component.selected.size).toBe(0);
      const boxes = Array.from(el().querySelectorAll('.ce-row-check')) as HTMLInputElement[];
      expect(boxes.map((b) => b.checked)).toEqual([false, false, false, false, false]);
      expect(boxes.map((b) => b.disabled)).toEqual([false, true, false, true, true]);

      component.toggleSelectPage();
      // Same as without ranking: invitable rows in row order (#3 before #2), invited #1 excluded.
      expect([...component.selected.keys()]).toEqual(['p1', 'p3']);
      component.sendInvites();
      const post = http.expectOne((r) => r.method === 'POST');
      expect(post.request.body).toEqual({ creatorIds: ['p1', 'p3'] });
      post.flush({ success: true, data: { requested: 2, invited: [], skipped: [] } });
      expectLoad().flush({ success: true, data: withRanking(rows()) });
    });

    it('selection is identical with and without ranking data', () => {
      const strip = (r: CampaignEligibilityRow) => {
        const { rank, rankingReasons, rankingEvidence, ...rest } = r;
        void rank;
        void rankingReasons;
        void rankingEvidence;
        return rest as CampaignEligibilityRow;
      };
      load(withRanking(rows()));
      const selectable = component.selectableOnPage.map((r) => r.creatorId);
      component.toggleSelectPage();
      const withRanks = [...component.selected.keys()];

      component.clearSelection();
      component.data = list(rows().map(strip));
      expect(component.selectableOnPage.map((r) => r.creatorId)).toEqual(selectable);
      component.toggleSelectPage();
      expect([...component.selected.keys()]).toEqual(withRanks);
    });
  });
});
