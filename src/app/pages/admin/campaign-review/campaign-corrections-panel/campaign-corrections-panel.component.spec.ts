import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  CampaignCorrectionsPanelComponent,
  CorrectionInvite,
  CorrectionsView,
} from './campaign-corrections-panel.component';

const allowed = { allowed: true };
const denied = (why: string) => ({ allowed: false, why });

const invite = (over: Partial<CorrectionInvite> = {}): CorrectionInvite => ({
  inviteId: 'inv1',
  creatorName: 'Siri Reddy',
  recipientRole: 'influencer',
  status: 'withdrawn',
  selectedPostDate: '2026-10-07T00:00:00.000Z',
  paymentConfirmedAt: '2026-09-30T12:47:52.094Z',
  submissionClosesAt: '2026-10-09T00:00:00.000Z',
  submissionDeadlineExtendedTo: null,
  withdrawnAt: '2026-10-06T00:00:00.144Z',
  withdrawal: { reason: 'expired_unsubmitted', previousStatus: 'payment_confirmed' },
  payment: {
    amountPaise: 90000,
    collectionStatus: 'verified',
    payoutStatus: 'skipped',
    resolveOutcome: 'refund_to_brand',
  },
  corrections: [],
  actions: {
    restore: allowed,
    extendDeadline: denied('Only accepted work'),
    submitOnBehalf: denied('Only accepted work'),
    cancel: denied('Only accepted work'),
  },
  ...over,
});

const view = (invites: CorrectionInvite[]): CorrectionsView => ({
  campaign: {
    id: 'c24',
    campaignNumber: 24,
    title: 'Brands are you looking for creators',
    status: 'active',
    endDate: '2026-10-10T00:00:00.000Z',
    timelineEnd: '2026-10-10T00:00:00.000Z',
    endsAt: '2026-10-10T18:29:59.999Z',
    completedBy: null,
    completedAt: null,
    adminOverrideAction: null,
    adminOverrideReason: '',
    adminOverrideAt: null,
  },
  actions: { extendEndDate: allowed },
  rules: { graceHours: 24, maxExtensionDays: 7 },
  invites,
});

describe('CampaignCorrectionsPanelComponent (admin)', () => {
  let fixture: ComponentFixture<CampaignCorrectionsPanelComponent>;
  let component: CampaignCorrectionsPanelComponent;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().innerText.replace(/\s+/g, ' ');
  const buttons = () => Array.from(el().querySelectorAll('button')) as HTMLButtonElement[];
  const button = (label: string) => buttons().find((b) => b.textContent!.trim() === label);
  const getUrl = (u: string) => u.endsWith('/admin/campaign-corrections/campaigns/c24');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CampaignCorrectionsPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(CampaignCorrectionsPanelComponent);
    component = fixture.componentInstance;
    component.campaignId = 'c24';
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const loadWith = (v: CorrectionsView) => {
    fixture.detectChanges();
    http.expectOne((q) => getUrl(q.url)).flush({ success: true, data: v });
    fixture.detectChanges();
  };

  it('shows the campaign and each creator with only the actions the server allows', () => {
    loadWith(
      view([
        invite(),
        invite({
          inviteId: 'inv2',
          creatorName: 'Pramisuri',
          status: 'payment_confirmed',
          withdrawal: null,
          payment: { amountPaise: 60000, collectionStatus: 'verified', payoutStatus: 'pending', resolveOutcome: null },
          actions: {
            restore: denied('Only withdrawn participation can be restored.'),
            extendDeadline: allowed,
            submitOnBehalf: allowed,
            cancel: allowed,
          },
        }),
      ]),
    );
    expect(text()).toContain('CMP-24');
    expect(text()).toContain('Withdrawn Closed automatically (no submission) (was payment_confirmed)');
    expect(text()).toContain('₹900 · collected · payout skipped · marked refund to host');
    const restoreButtons = buttons().filter((b) => b.textContent!.trim() === 'Restore participation');
    expect(restoreButtons.length).toBe(1); // only Siri's row
    expect(button('Extend deadline')).toBeTruthy();
    expect(button('Submit post link')).toBeTruthy();
    expect(button('Cancel participation')).toBeTruthy();
  });

  it('restore: needs a reason and, when the payment says refund to host, the no-refund confirmation', () => {
    loadWith(view([invite()]));
    component.open('restore', component.data!.invites[0]);
    fixture.detectChanges();
    expect(text()).toContain('I confirm the host has not been refunded');

    component.reason = 'Host asked — auto-close ran early';
    expect(component.canSubmit).toBeFalse(); // confirmation missing
    component.hostNotRefunded = true;
    expect(component.canSubmit).toBeTrue();

    component.submit();
    const req = http.expectOne((q) => q.url.endsWith('/admin/campaign-corrections/invites/inv1/restore'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Host asked — auto-close ran early', hostNotRefunded: true });
    req.flush({ success: true });
    // Reloads after a successful correction.
    http.expectOne((q) => getUrl(q.url)).flush({ success: true, data: view([]) });
    fixture.detectChanges();
    expect(text()).toContain('Restore participation: done.');
  });

  it("shows the server's refusal and keeps the form open", () => {
    loadWith(view([invite()]));
    component.open('restore', component.data!.invites[0]);
    component.reason = 'Host asked — auto-close ran early';
    component.hostNotRefunded = true;
    component.submit();
    http
      .expectOne((q) => q.url.endsWith('/invites/inv1/restore'))
      .flush({ message: 'A payout for this collaboration was already paid.' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(component.action).toBe('restore');
    expect(text()).toContain('A payout for this collaboration was already paid.');
  });

  it('extend end date sends the India date; a short reason keeps Apply disabled', () => {
    loadWith(view([]));
    component.open('endDate');
    component.endDate = '2026-10-14';
    component.reason = 'too short';
    expect(component.canSubmit).toBeFalse();
    component.reason = 'Host asked to run until the 14th';
    component.submit();
    const req = http.expectOne((q) => q.url.endsWith('/campaigns/c24/extend-end-date'));
    expect(req.request.body).toEqual({ endDate: '2026-10-14', reason: 'Host asked to run until the 14th' });
    req.flush({ success: true });
    http.expectOne((q) => getUrl(q.url)).flush({ success: true, data: view([]) });
  });

  it('submit-on-behalf needs a full link', () => {
    loadWith(view([invite({ status: 'payment_confirmed', actions: { ...invite().actions, submitOnBehalf: allowed } })]));
    component.open('submitOnBehalf', component.data!.invites[0]);
    component.reason = 'Host confirmed the post on Instagram';
    component.postUrl = 'instagram.com/p/abc';
    expect(component.canSubmit).toBeFalse();
    component.postUrl = 'https://instagram.com/p/abc';
    expect(component.canSubmit).toBeTrue();
  });
});
