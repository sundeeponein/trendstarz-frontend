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
  ...over,
});

const list = (rows: CampaignEligibilityRow[]): CampaignEligibilityList => {
  const counts = { PASS: 1, UNKNOWN: 0, FAIL: 1 };
  const rc = { PASS: 2, UNKNOWN: 0, FAIL: 0, configured: true };
  return {
    campaign: {
      campaignId: 'camp-1',
      title: 'Diwali Reels',
      status: 'active',
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
    scope: { creatorType: 'Influencer', evaluated: 2 },
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
});
