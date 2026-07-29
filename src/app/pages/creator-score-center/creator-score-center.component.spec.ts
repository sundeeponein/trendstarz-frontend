import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { AnalyticsService } from '../../core/analytics.service';
import { CollaborationScoreApiService } from '../../services/collaboration-score-api.service';
import { ToastService } from '../../shared/toast/toast.service';
import { CreatorScoreCenterComponent } from './creator-score-center.component';

describe('CreatorScoreCenterComponent', () => {
  let apiSpy: jasmine.SpyObj<CollaborationScoreApiService>;
  let sessionSpy: jasmine.SpyObj<SessionService>;
  let configSpy: jasmine.SpyObj<ConfigService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let analyticsSpy: jasmine.SpyObj<AnalyticsService>;
  let router: Router;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<CollaborationScoreApiService>('CollaborationScoreApiService', [
      'getAudit',
      'getAuditHistory',
      'getConnections',
      'runMyAudit',
      'getAuditVersion',
      'getPlatformFlags',
      'getSyncStatus',
      'syncLatestProfile',
    ]);
    sessionSpy = jasmine.createSpyObj<SessionService>('SessionService', ['getUser']);
    configSpy = jasmine.createSpyObj<ConfigService>('ConfigService', [
      'getInfluencerProfileById',
      'getPhotographerProfileById',
    ]);
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning']);
    analyticsSpy = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', [
      'trackCollabSyncStarted',
      'trackCollabSyncCompleted',
      'trackCollabSyncChangesDetected',
      'trackCollabSyncNoChanges',
    ]);

    apiSpy.getAudit.and.returnValue(of(null as any));
    apiSpy.getAuditHistory.and.returnValue(of({ history: [] }));
    apiSpy.getConnections.and.returnValue(of({ instagram: null, facebook: null }));
    apiSpy.getPlatformFlags.and.returnValue(
      of({ platformsEnabled: { instagram: true, youtube: true, facebook: true, linkedin: true } }),
    );
    apiSpy.getSyncStatus.and.returnValue(of({ platforms: [], hasChanges: false }));
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
        { provide: AnalyticsService, useValue: analyticsSpy },
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

  describe('admin platform toggles', () => {
    it('drops a row entirely when an admin has disabled that platform, rather than showing it as Not Connected', () => {
      sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
      apiSpy.getPlatformFlags.and.returnValue(
        of({ platformsEnabled: { instagram: false, youtube: true, facebook: true, linkedin: true } }),
      );
      const { fixture, component } = createComponent();

      fixture.detectChanges();

      expect(component.platformStatus.map((row) => row.platform)).toEqual(['YouTube', 'Facebook', 'LinkedIn']);
    });

    it('keeps LinkedIn visible as Coming Soon regardless of its own toggle state', () => {
      sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
      apiSpy.getPlatformFlags.and.returnValue(
        of({ platformsEnabled: { instagram: true, youtube: true, facebook: true, linkedin: false } }),
      );
      const { fixture, component } = createComponent();

      fixture.detectChanges();

      expect(component.platformStatus.find((row) => row.platform === 'LinkedIn')?.status).toBe('Coming Soon');
    });

    it('fails open (shows every row) if the flags request errors', () => {
      sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
      apiSpy.getPlatformFlags.and.returnValue(throwError(() => new Error('network down')));
      const { fixture, component } = createComponent();

      fixture.detectChanges();

      expect(component.platformStatus.length).toBe(4);
    });
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
        { met: false, label: 'LinkedIn', absentLabel: 'LinkedIn (Coming Soon)' },
      ]);
    });

    it('always lists LinkedIn as Coming Soon, never as a real connected/absent state', () => {
      apiSpy.getAudit.and.returnValue(
        of(
          fakeAudit({
            collaborationScore: 20,
            platformsCollected: [{ platform: 'LinkedIn', method: 'SELF_REPORTED', confidence: 0, confidenceReason: '' }],
          }) as any,
        ),
      );
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      const linkedIn = component.scoreConfidence?.basedOn.find((item) => item.label === 'LinkedIn');
      expect(linkedIn).toEqual({ met: false, label: 'LinkedIn', absentLabel: 'LinkedIn (Coming Soon)' });
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

  it('fetches connections only once and passes them to the embedded full card, instead of it fetching its own copy', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
    apiSpy.getConnections.and.returnValue(
      of({ instagram: { handle: 'shared', followersCount: 1, connectedAt: '2026-01-01' }, facebook: null }),
    );
    const { fixture, component } = createComponent();

    fixture.detectChanges();

    expect(apiSpy.getConnections).toHaveBeenCalledTimes(1);
    expect(component.connections?.instagram?.handle).toBe('shared');
  });

  describe('onSyncLatestProfile', () => {
    beforeEach(() => sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' }));

    it('merges the sync result onto platformStatus and refreshes the audit', () => {
      apiSpy.getAudit.and.returnValue(of(fakeAudit({ collaborationScore: 60 }) as any));
      configSpy.getInfluencerProfileById.and.returnValue(
        of({ socialMedia: [{ platform: 'YouTube', handle: 'creator' }] }),
      );
      apiSpy.syncLatestProfile.and.returnValue(
        of({ platforms: [{ platform: 'YouTube', lastSyncedAt: '2026-07-29', hasChanges: true }], hasChanges: true }),
      );
      const { fixture, component } = createComponent();
      fixture.detectChanges();
      apiSpy.getAudit.calls.reset();

      component.onSyncLatestProfile();

      expect(analyticsSpy.trackCollabSyncStarted).toHaveBeenCalled();
      expect(analyticsSpy.trackCollabSyncCompleted).toHaveBeenCalledWith({ success: true });
      expect(analyticsSpy.trackCollabSyncChangesDetected).toHaveBeenCalledWith({ platforms: ['YouTube'] });
      expect(component.syncing).toBe(false);
      expect(apiSpy.getAudit).toHaveBeenCalled();
      const youtubeRow = component.platformStatus.find((row) => row.platform === 'YouTube');
      expect(youtubeRow?.hasChanges).toBe(true);
      expect(youtubeRow?.lastSyncedAt).toBe('2026-07-29');
    });

    it('tracks NoChanges when nothing changed', () => {
      apiSpy.syncLatestProfile.and.returnValue(
        of({ platforms: [{ platform: 'YouTube', lastSyncedAt: '2026-07-29', hasChanges: false }], hasChanges: false }),
      );
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      component.onSyncLatestProfile();

      expect(analyticsSpy.trackCollabSyncNoChanges).toHaveBeenCalled();
      expect(analyticsSpy.trackCollabSyncChangesDetected).not.toHaveBeenCalled();
    });

    it('shows a toast and tracks failure when the sync call errors', () => {
      apiSpy.syncLatestProfile.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      component.onSyncLatestProfile();

      expect(analyticsSpy.trackCollabSyncCompleted).toHaveBeenCalledWith({ success: false });
      expect(toastSpy.error).toHaveBeenCalledWith('boom');
      expect(component.syncing).toBe(false);
    });

    it('ignores a second onSyncLatestProfile() call while the first is still in flight', () => {
      apiSpy.syncLatestProfile.and.returnValue(new Subject<any>());
      const { fixture, component } = createComponent();
      fixture.detectChanges();

      component.onSyncLatestProfile();
      component.onSyncLatestProfile();

      expect(apiSpy.syncLatestProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('ignores a second onReAnalyze() call while the first is still in flight', () => {
    sessionSpy.getUser.and.returnValue({ _id: 'u1', role: 'influencer' });
    apiSpy.runMyAudit.and.returnValue(new Subject<any>());
    const { fixture, component } = createComponent();
    fixture.detectChanges();

    component.onReAnalyze();
    component.onReAnalyze();

    expect(apiSpy.runMyAudit).toHaveBeenCalledTimes(1);
  });
});
