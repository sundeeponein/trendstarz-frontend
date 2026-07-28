import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CollaborationScoreSummaryWidgetComponent } from './collaboration-score-summary-widget.component';

describe('CollaborationScoreSummaryWidgetComponent', () => {
  function createComponent() {
    const fixture = TestBed.createComponent(CollaborationScoreSummaryWidgetComponent);
    return { fixture, component: fixture.componentInstance };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CollaborationScoreSummaryWidgetComponent],
      providers: [provideRouter([])],
    });
  });

  it('shows the no-audit empty state and emits generateScore on click', () => {
    const { fixture, component } = createComponent();
    component.audit = null;
    component.loading = false;
    fixture.detectChanges();

    const emitSpy = spyOn(component.generateScore, 'emit');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cssw-empty button');
    expect(button.textContent).toContain('Generate FREE Score');
    button.click();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('shows the score summary with a View Report link when an audit exists', () => {
    const { fixture, component } = createComponent();
    component.audit = {
      collaborationScore: 82,
      campaignReadiness: 'Campaign Ready',
      createdAt: '2026-07-26T00:00:00.000Z',
    } as any;
    component.loading = false;
    fixture.detectChanges();

    const badge: HTMLElement = fixture.nativeElement.querySelector('.cssw-score-badge');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[routerLink="/dashboard/trendstarz-score"]');
    expect(badge.textContent).toContain('82');
    expect(fixture.nativeElement.textContent).toContain('Campaign Ready');
    expect(link).toBeTruthy();
  });

  it('disables the generate button while a request is in flight', () => {
    const { fixture, component } = createComponent();
    component.audit = null;
    component.generating = true;
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.cssw-empty button');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Generating');
  });

  it('shows a loading state instead of empty/summary while loading', () => {
    const { fixture } = createComponent();
    const component = fixture.componentInstance;
    component.loading = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cssw-loading')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.cssw-empty')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.cssw-summary')).toBeFalsy();
  });
});
