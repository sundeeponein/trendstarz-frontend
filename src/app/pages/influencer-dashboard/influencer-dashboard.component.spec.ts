import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { InfluencerDashboardComponent } from './influencer-dashboard.component';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { DashboardService } from '../../services/dashboard.service';
import { PlansService } from '../../shared/plans.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ShippingAddressModalService } from '../../shared/components/shipping-address-modal/shipping-address-modal.service';
import { MonetizationApiService } from '../../services/monetization-api.service';
import { Router } from '@angular/router';
import { CollaborationScoreApiService } from '../../services/collaboration-score-api.service';

describe('InfluencerDashboardComponent usage summary', () => {
  async function createComponent(options?: { includeUsage?: boolean }) {
    const user = {
      role: 'influencer',
      name: 'Mia Frames',
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
      getInfluencerProfileById: () => of(user),
      getMyInvites: () => of([]),
      getInfluencerAttentionCounts: () => of({ data: {} }),
      getMyCampaignTransactions: () => of([]),
    };

    const dashboardServiceStub = {
      getInfluencerDashboard: () => of({
        data: {
          user: {
            name: 'Mia Frames',
            categories: ['fashion'],
            socialMedia: [{ platform: 'instagram' }],
            location: { state: 'Karnataka' },
            createdAt: '2026-05-01T00:00:00.000Z',
            lastLoginAt: '2026-05-20T00:00:00.000Z',
          },
          activeCampaigns: [],
          completedCampaigns: [],
          invites: { invited: 0, accepted: 0, submitted: 0, completed: 0 },
        },
      }),
      respondToInvite: () => of({}),
    };

    const monetizationStub = {
      getMyUsage: () => of({
        success: true,
        usage: options?.includeUsage === false
          ? null
          : {
              day: '2026-05-28',
              search: { used: 4, limit: 25, remaining: 21 },
              profileViews: { used: 9, limit: 50, remaining: 41 },
            },
      }),
    };

    const plansStub = {
      getMyCapabilities: () => of({}),
      getFeatureValue: () => false,
    };

    const collaborationScoreApiSpy = jasmine.createSpyObj<CollaborationScoreApiService>(
      'CollaborationScoreApiService',
      ['getAudit', 'runMyAudit'],
    );
    collaborationScoreApiSpy.getAudit.and.returnValue(of(null as any));
    collaborationScoreApiSpy.runMyAudit.and.returnValue(of({ collaborationScore: 50 } as any));

    await TestBed.configureTestingModule({
      imports: [InfluencerDashboardComponent],
      providers: [
        { provide: SessionService, useValue: sessionStub },
        { provide: ConfigService, useValue: configStub },
        { provide: DashboardService, useValue: dashboardServiceStub },
        { provide: PlansService, useValue: plansStub },
        { provide: MonetizationApiService, useValue: monetizationStub },
        { provide: CollaborationScoreApiService, useValue: collaborationScoreApiSpy },
        { provide: ToastService, useValue: { info: jasmine.createSpy('info'), success: jasmine.createSpy('success'), error: jasmine.createSpy('error') } },
        { provide: ShippingAddressModalService, useValue: { prompt: () => Promise.resolve(null) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    })
      .overrideComponent(InfluencerDashboardComponent, {
        set: {
          template: `
            <div class="dashboard-welcome-right account-meta-card">
              <div><strong>Registered on:</strong> {{ firstRegisteredAtDisplay ? (firstRegisteredAtDisplay | date:'medium') : '-' }}</div>
              <div><strong>Last Login:</strong> {{ lastLoginAtDisplay ? (lastLoginAtDisplay | date:'medium') : '-' }}</div>
              <div *ngIf="usageSummary"><strong>Daily profile views:</strong> {{ usageSummary.profileViews.used }}/{{ usageSummary.profileViews.limit }}</div>
              <div *ngIf="usageSummary"><strong>Daily searches:</strong> {{ usageSummary.search.used }}/{{ usageSummary.search.limit }}</div>
            </div>
          `,
        },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(InfluencerDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders daily usage counts in the welcome card', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Daily profile views: 9/50');
    expect(text).toContain('Daily searches: 4/25');
  });

  it('does not render usage rows when usage is unavailable', async () => {
    const fixture = await createComponent({ includeUsage: false });
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Daily profile views:');
    expect(text).not.toContain('Daily searches:');
  });

  it('ignores a second onReAnalyzeCollaborationScore() call while the first is still in flight', async () => {
    const fixture = await createComponent();
    const api = TestBed.inject(CollaborationScoreApiService) as jasmine.SpyObj<CollaborationScoreApiService>;
    // A never-completing Subject keeps the request "in flight" across both
    // synchronous calls below — of(...) would resolve immediately and reset
    // the guard flag before the second call, hiding the bug this protects.
    api.runMyAudit.and.returnValue(new Subject<any>());

    fixture.componentInstance.onReAnalyzeCollaborationScore();
    fixture.componentInstance.onReAnalyzeCollaborationScore();

    expect(api.runMyAudit).toHaveBeenCalledTimes(1);
  });
});