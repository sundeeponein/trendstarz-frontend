import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { CollaborationScoreApiService } from '../../services/collaboration-score-api.service';
import { ToastService } from '../../shared/toast/toast.service';
import { CreatorScoreCenterComponent } from './creator-score-center.component';

describe('CreatorScoreCenterComponent', () => {
  let apiSpy: jasmine.SpyObj<CollaborationScoreApiService>;
  let sessionSpy: jasmine.SpyObj<SessionService>;
  let configSpy: jasmine.SpyObj<ConfigService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let router: Router;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<CollaborationScoreApiService>('CollaborationScoreApiService', [
      'getAudit',
      'getAuditHistory',
      'getConnections',
      'runMyAudit',
      'getAuditVersion',
    ]);
    sessionSpy = jasmine.createSpyObj<SessionService>('SessionService', ['getUser']);
    configSpy = jasmine.createSpyObj<ConfigService>('ConfigService', [
      'getInfluencerProfileById',
      'getPhotographerProfileById',
    ]);
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning']);

    apiSpy.getAudit.and.returnValue(of(null as any));
    apiSpy.getAuditHistory.and.returnValue(of({ history: [] }));
    apiSpy.getConnections.and.returnValue(of({ instagram: null, facebook: null }));
    configSpy.getInfluencerProfileById.and.returnValue(of({ socialMedia: [] }));
    configSpy.getPhotographerProfileById.and.returnValue(of({ socialMedia: [] }));

    await TestBed.configureTestingModule({
      imports: [CreatorScoreCenterComponent],
      providers: [
        provideRouter([]),
        { provide: CollaborationScoreApiService, useValue: apiSpy },
        { provide: SessionService, useValue: sessionSpy },
        { provide: ConfigService, useValue: configSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  function createComponent() {
    const fixture = TestBed.createComponent(CreatorScoreCenterComponent);
    return { fixture, component: fixture.componentInstance };
  }

  // CollaborationScoreCardComponent's own template assumes a full audit
  // shape (e.g. pricingSuggestion) once `audit` is truthy — always true for
  // a real backend response, but a bare partial mock needs padding out here.
  function fakeAudit(overrides: any = {}) {
    return {
      collaborationScore: 0,
      campaignReadiness: 'Not Ready',
      trendstarzRecommended: false,
      portfolioScore: null,
      pricingSuggestion: { reelPrice: null, storyPrice: null, videoPrice: null, currency: 'INR', basis: '' },
      categoryMatch: [],
      createdAt: '2026-01-01',
      ...overrides,
    };
  }

  it('redirects Brand accounts to /brand-dashboard and never loads anything', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'b1', role: 'brand' });
    const navSpy = spyOn(router, 'navigate');
    const { fixture } = createComponent();

    fixture.detectChanges();

    expect(navSpy).toHaveBeenCalledWith(['/brand-dashboard']);
    expect(apiSpy.getAudit).not.toHaveBeenCalled();
  });

  it('loads audit, history, and connections for an influencer', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
    apiSpy.getAudit.and.returnValue(of(fakeAudit({ collaborationScore: 82 }) as any));
    const { fixture, component } = createComponent();

    fixture.detectChanges();

    expect(apiSpy.getAudit).toHaveBeenCalledWith('u1');
    expect(apiSpy.getAuditHistory).toHaveBeenCalledWith('u1', 20);
    expect(configSpy.getInfluencerProfileById).toHaveBeenCalled();
    expect(configSpy.getPhotographerProfileById).not.toHaveBeenCalled();
    expect(component.audit?.collaborationScore).toBe(82);
  });

  it('uses the photographer profile fetch for a photographer', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'p1', role: 'photographer' });
    const { fixture } = createComponent();

    fixture.detectChanges();

    expect(configSpy.getPhotographerProfileById).toHaveBeenCalled();
    expect(configSpy.getInfluencerProfileById).not.toHaveBeenCalled();
  });

  it('builds the 4-platform status grid, with LinkedIn always Coming Soon', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
    apiSpy.getConnections.and.returnValue(
      of({ instagram: { handle: 'x', followersCount: 1, connectedAt: '2026-01-01' }, facebook: null }),
    );
    configSpy.getInfluencerProfileById.and.returnValue(
      of({ socialMedia: [{ platform: 'YouTube', handle: 'creator' }] }),
    );
    const { fixture, component } = createComponent();

    fixture.detectChanges();

    expect(component.platformStatus).toEqual([
      { platform: 'Instagram', icon: 'bi-instagram', status: 'Connected' },
      { platform: 'YouTube', icon: 'bi-youtube', status: 'Connected' },
      { platform: 'Facebook', icon: 'bi-facebook', status: 'Not Connected' },
      { platform: 'LinkedIn', icon: 'bi-linkedin', status: 'Coming Soon' },
    ]);
  });

  it('toggleHistoryDetail fetches and shows, then hides on a second click', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
    apiSpy.getAuditVersion.and.returnValue(of({ collaborationScore: 70, campaignReadiness: 'Growing' } as any));
    const { fixture, component } = createComponent();
    fixture.detectChanges();

    const entry: any = { version: 1, collaborationScore: 70, createdAt: '2026-06-01', isPaid: false };
    component.toggleHistoryDetail(entry);

    expect(apiSpy.getAuditVersion).toHaveBeenCalledWith('u1', 1);
    expect(component.expandedVersion).toBe(1);
    expect(component.expandedDetail).toEqual({ collaborationScore: 70, campaignReadiness: 'Growing' } as any);

    component.toggleHistoryDetail(entry);
    expect(component.expandedVersion).toBeNull();
    expect(component.expandedDetail).toBeNull();
  });

  it('shows a toast and stops loading if fetching a past version fails', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
    apiSpy.getAuditVersion.and.returnValue(throwError(() => new Error('boom')));
    const { fixture, component } = createComponent();
    fixture.detectChanges();

    component.toggleHistoryDetail({ version: 1 } as any);

    expect(toastSpy.error).toHaveBeenCalled();
    expect(component.expandedLoading).toBe(false);
  });

  describe('scoreConfidence', () => {
    beforeEach(() => sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' }));

    it('is null before any audit exists', () => {
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      expect(component.scoreConfidence).toBeNull();
    });

    it('is High when a platform has rich, verified API data', () => {
      apiSpy.getAudit.and.returnValue(
        of(
          fakeAudit({
            collaborationScore: 90,
            platformsCollected: [{ platform: 'YouTube', method: 'API', confidence: 95, confidenceReason: '' }],
          }) as any,
        ),
      );
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      expect(component.scoreConfidence?.level).toBe('High');
      expect(component.scoreConfidence?.basedOn).toEqual([
        { met: true, label: 'TrendStarZ Profile', absentLabel: 'TrendStarZ Profile' },
        { met: true, label: 'YouTube', absentLabel: 'YouTube not added' },
        { met: false, label: 'Instagram', absentLabel: 'Instagram not connected' },
        { met: false, label: 'Facebook', absentLabel: 'Facebook not connected' },
      ]);
    });

    it('is Medium for a connected platform with sparse data', () => {
      apiSpy.getAudit.and.returnValue(
        of(
          fakeAudit({
            collaborationScore: 60,
            platformsCollected: [{ platform: 'Instagram', method: 'API', confidence: 55, confidenceReason: '' }],
          }) as any,
        ),
      );
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      expect(component.scoreConfidence?.level).toBe('Medium');
    });

    it('is Low when there are no collected platforms at all', () => {
      apiSpy.getAudit.and.returnValue(of(fakeAudit({ collaborationScore: 20, platformsCollected: [] }) as any));
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      expect(component.scoreConfidence?.level).toBe('Low');
      expect(component.scoreConfidence?.basedOn.every((item) => item.label === 'TrendStarZ Profile' || !item.met)).toBe(true);
    });
  });

  it('onReAnalyze runs the free audit and refreshes history', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
    apiSpy.runMyAudit.and.returnValue(of(fakeAudit({ collaborationScore: 55 }) as any));
    const { fixture, component } = createComponent();
    fixture.detectChanges();
    apiSpy.getAuditHistory.calls.reset();

    component.onReAnalyze();

    expect(component.audit?.collaborationScore).toBe(55);
    expect(component.reAnalyzing).toBe(false);
    expect(apiSpy.getAuditHistory).toHaveBeenCalled();
  });
});
