import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfigService } from '../../config.service';
import { PlansService } from '../../plans.service';
import { ToastService } from '../../toast/toast.service';
import { HostEligibilityView } from '../host-eligibility.util';
import { CampaignFormComponent } from './campaign-form.component';

/**
 * Campaign form, step 3 (invite): the campaign's own requirements now shape the
 * list — target location pre-fills the location filter once, and every
 * approved creator gets the server's "meets requirements" label (computed from
 * the unsaved step-2 requirements), with an opt-in "meets only" filter.
 *
 * Tested through the component's API without rendering the page: rendering the
 * full step-3 template hits Angular's change-detection loop guard in this
 * zoneless unit harness (with or without these changes). The badge/toggle
 * markup is covered by the strict production template compile and mirrors the
 * campaign-management invite drawer (Stage 3B-4).
 */
describe('CampaignFormComponent — step 3 respects the campaign requirements', () => {
  let fixture: ComponentFixture<CampaignFormComponent>;
  let component: CampaignFormComponent;
  let config: Record<string, jasmine.Spy>;
  let previewView: HostEligibilityView | null;
  let influencers: any[];

  const view = (creators: HostEligibilityView['creators']): HostEligibilityView => ({
    campaignId: '',
    supported: true,
    configured: ['Location', 'Tier'],
    creators,
  });
  const creator = (id: string, state = 'Telangana') => ({
    _id: id,
    name: `Creator ${id}`,
    isEmailVerified: true,
    isMobileVerified: true,
    verificationStatus: 'approved',
    verifiedByTrendStarz: true,
    location: { state, district: 'Hyderabad' },
    categories: [],
    socialMedia: [{ platform: 'Instagram', tier: 'Micro' }],
  });

  beforeEach(async () => {
    previewView = view({});
    influencers = [];
    config = {};
    // Every ConfigService call returns an empty result unless a test sets data.
    const configStub = new Proxy(
      {},
      {
        get: (_t, prop: string) =>
          (config[prop] ||= jasmine.createSpy(prop).and.callFake(() => {
            if (prop === 'previewCampaignCreatorEligibility') return of(previewView);
            if (prop === 'getInfluencers') return of(influencers);
            return of([]);
          })),
      },
    );
    await TestBed.configureTestingModule({
      imports: [CampaignFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ConfigService, useValue: configStub },
        {
          provide: PlansService,
          useValue: {
            getMyCapabilities: () => of({}),
            getLimitValue: () => -1,
            getFeatureValue: () => false,
          },
        },
        {
          provide: ToastService,
          useValue: jasmine.createSpyObj('toast', ['error', 'success', 'info']),
        },
      ],
    }).compileComponents();
  });

  const setup = () => {
    fixture = TestBed.createComponent(CampaignFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit (builds the form); the page itself is not rendered
    // Step-2 validation is not under test here.
    spyOn(component, 'step2Valid').and.returnValue(true);
  };
  const enterStep3 = () => component.goToStep(3);
  const lastInfluencerQuery = () => config['getInfluencers'].calls.mostRecent().args[0];

  it('pre-fills the location filter from the target location and fetches with it', () => {
    setup();
    component.form.patchValue({ targetState: 'Telangana', targetDistrict: 'Hyderabad' });
    enterStep3();
    expect(component.filterState).toBe('Telangana');
    expect(component.filterDistrict).toBe('Hyderabad');
    expect(lastInfluencerQuery()).toEqual(
      jasmine.objectContaining({
        state: 'Telangana',
        district: 'Hyderabad',
        campaignEligible: true,
      }),
    );
  });

  it('pre-fills only once: a filter the host cleared stays cleared', () => {
    setup();
    component.form.patchValue({ targetState: 'Telangana', targetDistrict: 'Hyderabad' });
    enterStep3();
    component.filterState = '';
    component.filterDistrict = '';
    component.goToStep(2);
    enterStep3();
    expect(component.filterState).toBe('');
  });

  it('never overrides a location the host already picked', () => {
    setup();
    component.form.patchValue({ targetState: 'Telangana' });
    component.filterState = 'Kerala';
    enterStep3();
    expect(component.filterState).toBe('Kerala');
  });

  it('no target location → no location filter', () => {
    setup();
    enterStep3();
    expect(component.filterState).toBe('');
    expect(lastInfluencerQuery().state).toBeUndefined();
  });

  it('asks the server to label creators against the unsaved step-2 requirements', () => {
    setup();
    component.form.patchValue({
      targetState: 'Telangana',
      targetDistrict: 'Hyderabad',
      minInfluencerTier: 'Micro',
      languages: ['Telugu'],
    });
    enterStep3();
    const body = config['previewCampaignCreatorEligibility'].calls.mostRecent().args[0];
    expect(body).toEqual(
      jasmine.objectContaining({
        inviteRecipientRole: 'influencer',
        minInfluencerTier: 'Micro',
        targetState: 'Telangana',
        targetDistrict: 'Hyderabad',
        languages: ['Telugu'],
      }),
    );
    // Only requirement fields — no invite ids or other campaign data.
    expect(Object.keys(body)).not.toContain('inviteInfluencerIds');
    expect(Object.keys(body)).not.toContain('title');
  });

  it('labels each creator and filters only when the host opts in', () => {
    previewView = view({
      ok: { status: 'meets', notMet: [], needsInfo: [] },
      far: { status: 'not_met', notMet: ['Location'], needsInfo: [] },
      unknown: { status: 'needs_info', notMet: [], needsInfo: ['Language'] },
    });
    influencers = [creator('ok'), creator('far', 'Kerala'), creator('unknown')];
    setup();
    enterStep3();
    expect(component.showInviteEligibility).toBeTrue();
    const ids = () => component.filteredInfluencers.map((i: any) => i._id).sort();
    expect(ids()).toEqual(['far', 'ok', 'unknown']); // informational by default
    expect(component.inviteEligibilityBadge(creator('ok'))?.label).toBe('Meets requirements');
    expect(component.inviteEligibilityBadge(creator('far'))?.label).toBe("Doesn't match: Location");
    expect(component.inviteEligibilityBadge(creator('unknown'))?.label).toBe(
      'Missing info: Language',
    );
    expect(component.inviteEligibilityBadge(creator('stranger'))).toBeNull();

    component.inviteMeetsRequirementsOnly = true;
    expect(ids()).toEqual(['ok']);
  });

  it('a failed preview shows no labels and hides nobody', () => {
    previewView = null;
    influencers = [creator('a')];
    setup();
    enterStep3();
    component.inviteMeetsRequirementsOnly = true;
    expect(component.showInviteEligibility).toBeFalse();
    expect(component.filteredInfluencers.map((i: any) => i._id)).toEqual(['a']);
    expect(component.inviteEligibilityBadge(creator('a'))).toBeNull();
  });

  it('photographer invites: no preview (not checkable yet); the venue pre-fills the location', () => {
    setup();
    component.form.patchValue({
      inviteRecipientRole: 'photographer',
      venueState: 'Goa',
      targetState: '',
    });
    enterStep3();
    expect(config['previewCampaignCreatorEligibility']?.calls.count() ?? 0).toBe(0);
    expect(component.showInviteEligibility).toBeFalse();
    expect(component.filterState).toBe('Goa');
  });

  describe('acceptance deadline', () => {
    const daysFromNow = (n: number) =>
      new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const setupWith = (campaign: any, mode: 'create' | 'edit') => {
      fixture = TestBed.createComponent(CampaignFormComponent);
      component = fixture.componentInstance;
      component.campaign = campaign;
      component.mode = mode;
      fixture.detectChanges();
    };

    it("a duplicate ignores the source campaign's past deadline and uses its own start date", () => {
      // Duplicate of a campaign whose acceptance deadline is long gone (CMP-24).
      setupWith({ title: 'Copy', acceptanceDeadline: '2026-09-30T23:59:59.999Z' }, 'create');
      component.form.patchValue({ timelineStart: daysFromNow(5) });
      expect(component.isAcceptanceDeadlinePassed).toBeFalse();
      expect(component.canSelectMoreInfluencers()).toBeTrue();
    });

    it('a new campaign whose chosen start date makes the deadline already past is blocked', () => {
      setupWith(null, 'create');
      component.form.patchValue({ timelineStart: daysFromNow(-3) });
      expect(component.isAcceptanceDeadlinePassed).toBeTrue();
    });

    it("editing a saved campaign still uses that campaign's own deadline", () => {
      setupWith(
        { _id: 'c1', title: 'Saved', status: 'active', acceptanceDeadline: '2026-09-30T23:59:59.999Z' },
        'edit',
      );
      expect(component.isAcceptanceDeadlinePassed).toBeTrue();
      expect(component.canSelectMoreInfluencers()).toBeFalse();
    });
  });

  it('the save payload carries display names for the selected creators (for the invite results dialog)', () => {
    influencers = [creator('a'), creator('b')];
    setup();
    enterStep3();
    component.toggleInfluencerSelect('a');
    const payload = (component as any).buildSavePayload({});
    expect(payload.inviteRecipientIds).toEqual(['a']);
    expect(payload.inviteRecipientNames).toEqual({ a: 'Creator a' });
  });
});
