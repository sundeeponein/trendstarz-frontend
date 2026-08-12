import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CollaborationScoreApiService } from '../../services/collaboration-score-api.service';
import { ToastService } from '../toast/toast.service';
import { AnalyticsService } from '../../core/analytics.service';
import { CollaborationScoreCardComponent } from './collaboration-score-card.component';

// A parent that already fetched connections (CreatorScoreCenterComponent,
// which also needs them for its own Platform Status section) should be able
// to pass them straight through via [initialConnections] instead of this
// component re-fetching the exact same data itself.
describe('CollaborationScoreCardComponent — connections passthrough', () => {
  let apiSpy: jasmine.SpyObj<CollaborationScoreApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<CollaborationScoreApiService>('CollaborationScoreApiService', [
      'getConnections',
      'getAuditHistory',
    ]);
    apiSpy.getConnections.and.returnValue(of({ instagram: null, facebook: null }));
    apiSpy.getAuditHistory.and.returnValue(of({ history: [] }));

    await TestBed.configureTestingModule({
      imports: [CollaborationScoreCardComponent],
      providers: [
        { provide: CollaborationScoreApiService, useValue: apiSpy },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error', 'warning']) },
        {
          provide: AnalyticsService,
          useValue: jasmine.createSpyObj('AnalyticsService', [
            'trackCollabReanalyzeClicked',
            'trackCollabPaymentStarted',
            'trackCollabPaymentSuccess',
            'trackCollabPaymentFailed',
          ]),
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  it('does not self-fetch connections when a parent binds [initialConnections]', () => {
    // A bare TestBed.createComponent() with no host template never fires
    // ngOnChanges from a direct property assignment — call it explicitly,
    // exactly as Angular itself would for a real [initialConnections]
    // binding, which always fires before ngOnInit.
    const fixture = TestBed.createComponent(CollaborationScoreCardComponent);
    fixture.componentInstance.initialConnections = { instagram: { handle: 'x', followersCount: 1, connectedAt: '2026-01-01' }, facebook: null };
    fixture.componentInstance.ngOnChanges({
      initialConnections: {
        previousValue: undefined,
        currentValue: fixture.componentInstance.initialConnections,
        firstChange: true,
        isFirstChange: () => true,
      },
    } as any);
    fixture.detectChanges();

    expect(apiSpy.getConnections).not.toHaveBeenCalled();
    expect(fixture.componentInstance.connections.instagram?.handle).toBe('x');
  });

  it('adopts a later-arriving value if the parent binds [initialConnections] before its own fetch resolves', () => {
    const fixture = TestBed.createComponent(CollaborationScoreCardComponent);
    // Simulates the real-world case: the parent's own getConnections() call
    // is still in flight when this component first renders (bound to null,
    // but bound nonetheless — ngOnChanges fires either way, before ngOnInit).
    fixture.componentInstance.initialConnections = null;
    fixture.componentInstance.ngOnChanges({
      initialConnections: {
        previousValue: undefined,
        currentValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    } as any);
    fixture.detectChanges();

    expect(apiSpy.getConnections).not.toHaveBeenCalled();

    fixture.componentInstance.initialConnections = { instagram: { handle: 'later', followersCount: 5, connectedAt: '2026-01-02' }, facebook: null };
    fixture.componentInstance.ngOnChanges({
      initialConnections: {
        previousValue: null,
        currentValue: fixture.componentInstance.initialConnections,
        firstChange: false,
        isFirstChange: () => false,
      },
    } as any);

    expect(fixture.componentInstance.connections.instagram?.handle).toBe('later');
    expect(apiSpy.getConnections).not.toHaveBeenCalled();
  });

  it('still self-fetches connections for any consumer that does not bind [initialConnections] (backward compatible)', () => {
    const fixture = TestBed.createComponent(CollaborationScoreCardComponent);
    fixture.detectChanges();

    expect(apiSpy.getConnections).toHaveBeenCalled();
  });
});
