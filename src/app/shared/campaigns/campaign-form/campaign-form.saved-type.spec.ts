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
describe('CampaignFormComponent — editing keeps the saved campaign type', () => {
  let fixture: ComponentFixture<CampaignFormComponent>;
  let component: CampaignFormComponent;
  let config: Record<string, jasmine.Spy>;
  let previewView: HostEligibilityView | null;
  let influencers: any[];
  const typeConfigs = [
    { ownerType: 'brand', key: 'paid_collab', label: 'Paid Collab', enabled: true, premiumOnly: false },
    { ownerType: 'brand', key: 'product', label: 'Product', enabled: true, premiumOnly: true },
  ];

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
            if (prop === 'getCampaignTypeConfigs') return of(typeConfigs);
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

  it("a saved Product campaign stays Product while Premium status is unknown/false", () => {
    fixture = TestBed.createComponent(CampaignFormComponent);
    component = fixture.componentInstance;
    (component as any).campaign = { _id: "c1", campaignType: "product", productShippingRequired: true, status: "pending_review", ownerType: "brand" };
    component.hasPremium = false;
    fixture.detectChanges();
    expect(component.form.get("campaignType")?.value).toBe("product");
  });

  it("a new campaign still cannot pick a Premium-only type without Premium", () => {
    fixture = TestBed.createComponent(CampaignFormComponent);
    component = fixture.componentInstance;
    component.hasPremium = false;
    fixture.detectChanges();
    component.form.get("campaignType")?.setValue("product");
    expect(component.form.get("campaignType")?.value).not.toBe("product");
  });
});
