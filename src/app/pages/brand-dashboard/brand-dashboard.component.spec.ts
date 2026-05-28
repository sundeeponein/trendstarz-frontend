import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BrandDashboardComponent } from './brand-dashboard.component';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { MonetizationApiService } from '../../services/monetization-api.service';
import { PlansService } from '../../shared/plans.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';

describe('BrandDashboardComponent usage summary', () => {
  async function createComponent(options?: { includeUsage?: boolean }) {
    const user = {
      role: 'brand',
      brandName: 'Acme Studio',
      createdAt: '2026-05-01T00:00:00.000Z',
      lastLoginAt: '2026-05-20T00:00:00.000Z',
    };

    const sessionStub = {
      getUser: () => user,
      loadUserFromStorage: () => {},
      setUser: () => {},
      user$: of(user),
    };

    const configStub = {
      getSupportContact: () => of({ verificationCallNumber: '' }),
      getBrandProfileById: () => of(user),
      getMyCampaignTransactions: () => of([]),
      getBrandAttentionCounts: () => of({ data: {} }),
    };

    const dashboardServiceStub = {
      getBrandDashboard: () => of({
        data: {
          brand: {
            brandName: 'Acme Studio',
            categories: ['fashion'],
            location: { state: 'Karnataka' },
            createdAt: '2026-05-01T00:00:00.000Z',
            lastLoginAt: '2026-05-20T00:00:00.000Z',
          },
          campaigns: [],
          recommendedInfluencers: [],
        },
      }),
      searchInfluencers: () => of([]),
    };

    const monetizationStub = {
      getMyUsage: () => of({
        success: true,
        usage: options?.includeUsage === false
          ? null
          : {
              day: '2026-05-28',
              search: { used: 5, limit: 20, remaining: 15 },
              profileViews: { used: 12, limit: 40, remaining: 28 },
            },
      }),
    };

    const plansStub = {
      getMyCapabilities: () => of({}),
      getFeatureValue: () => false,
    };

    await TestBed.configureTestingModule({
      imports: [BrandDashboardComponent],
      providers: [
        { provide: SessionService, useValue: sessionStub },
        { provide: ConfigService, useValue: configStub },
        { provide: MonetizationApiService, useValue: monetizationStub },
        { provide: PlansService, useValue: plansStub },
        { provide: ToastService, useValue: { info: jasmine.createSpy('info') } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: ActivatedRoute, useValue: { snapshot: {}, params: of({}), queryParams: of({}) } },
      ],
    })
      .overrideComponent(BrandDashboardComponent, {
        set: {
          providers: [{ provide: DashboardService, useValue: dashboardServiceStub }],
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(BrandDashboardComponent);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  it('renders daily usage counts in the welcome card', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Daily profile views: 12/40');
    expect(text).toContain('Daily searches: 5/20');
  });

  it('does not render usage rows when usage is unavailable', async () => {
    const fixture = await createComponent({ includeUsage: false });
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Daily profile views:');
    expect(text).not.toContain('Daily searches:');
  });
});