import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AnalyticsService } from '../../core/analytics.service';
import { SessionService } from '../../core/session.service';
import { TrendstarzScoreComponent } from './trendstarz-score.component';

describe('TrendstarzScoreComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let sessionSpy: jasmine.SpyObj<SessionService>;
  let analyticsSpy: jasmine.SpyObj<AnalyticsService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    sessionSpy = jasmine.createSpyObj<SessionService>('SessionService', ['getToken', 'getUser']);
    analyticsSpy = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', [
      'trackTrendstarzScoreCheckClicked',
      'trackTrendstarzScoreFaqExpanded',
      'trackTrendstarzScorePlatformSectionViewed',
    ]);

    await TestBed.configureTestingModule({
      imports: [TrendstarzScoreComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: SessionService, useValue: sessionSpy },
        { provide: AnalyticsService, useValue: analyticsSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(TrendstarzScoreComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('sets the SEO title and meta description on init', () => {
    sessionSpy.getToken.and.returnValue(null);
    sessionSpy.getUser.and.returnValue(null);
    createComponent();

    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    expect(title.getTitle()).toBe('TrendStarZ Score | Measure Your Collaboration Readiness');
    expect(meta.getTag('name="description"')?.content).toContain('Discover your TrendStarZ Score');
  });

  it('routes an anonymous visitor to /audit and tracks loggedIn: false', () => {
    sessionSpy.getToken.and.returnValue(null);
    sessionSpy.getUser.and.returnValue(null);
    const { component } = createComponent();

    component.checkMyScore();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/audit']);
    expect(analyticsSpy.trackTrendstarzScoreCheckClicked).toHaveBeenCalledWith({
      loggedIn: false,
      destination: '/audit',
    });
  });

  it('routes a logged-in influencer to /influencer-dashboard', () => {
    sessionSpy.getToken.and.returnValue('token');
    sessionSpy.getUser.and.returnValue({ role: 'influencer' });
    const { component } = createComponent();

    component.checkMyScore();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/influencer-dashboard']);
    expect(analyticsSpy.trackTrendstarzScoreCheckClicked).toHaveBeenCalledWith({
      loggedIn: true,
      destination: '/influencer-dashboard',
    });
  });

  it('routes a logged-in brand to /brand-dashboard', () => {
    sessionSpy.getToken.and.returnValue('token');
    sessionSpy.getUser.and.returnValue({ role: 'Brand' });
    const { component } = createComponent();

    component.checkMyScore();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/brand-dashboard']);
  });

  it('routes a logged-in photographer to /photographer-dashboard', () => {
    sessionSpy.getToken.and.returnValue('token');
    sessionSpy.getUser.and.returnValue({ role: 'photographer' });
    const { component } = createComponent();

    component.checkMyScore();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/photographer-dashboard']);
  });

  it('tracks FAQ expansion with the question text', () => {
    sessionSpy.getToken.and.returnValue(null);
    sessionSpy.getUser.and.returnValue(null);
    const { component } = createComponent();

    component.onFaqToggled({ index: 0, question: 'What is TrendStarZ Score?' });

    expect(analyticsSpy.trackTrendstarzScoreFaqExpanded).toHaveBeenCalledWith({
      question: 'What is TrendStarZ Score?',
    });
  });

  it('never renders a real score — only the fixed illustrative hero example', () => {
    sessionSpy.getToken.and.returnValue(null);
    sessionSpy.getUser.and.returnValue(null);
    const { component, fixture } = createComponent();

    expect(component.heroExampleScore).toBe(82);
    const noteEl: HTMLElement = fixture.nativeElement.querySelector('.tss-hero-illustration-note');
    expect(noteEl?.textContent).toContain('illustrative only');
  });

  it('keeps future-ready placeholders hidden until an admin feature flag exists', () => {
    sessionSpy.getToken.and.returnValue(null);
    sessionSpy.getUser.and.returnValue(null);
    const { component, fixture } = createComponent();

    expect(component.futureFeaturesEnabled).toBe(false);
    const headings: string[] = Array.from(fixture.nativeElement.querySelectorAll('.tss-section-title')).map(
      (el: any) => el.textContent.trim(),
    );
    expect(headings).not.toContain('Coming Soon');
  });
});
