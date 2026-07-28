import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { CollaborationScoreApiService } from '../../services/collaboration-score-api.service';
import { ScorePreviewComponent } from './score-preview.component';

describe('ScorePreviewComponent — role-choice CTA', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let apiSpy: jasmine.SpyObj<CollaborationScoreApiService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    apiSpy = jasmine.createSpyObj<CollaborationScoreApiService>('CollaborationScoreApiService', [
      'previewFromYoutubeUrl',
    ]);
    apiSpy.previewFromYoutubeUrl.and.returnValue(of({} as any));

    await TestBed.configureTestingModule({
      imports: [ScorePreviewComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: CollaborationScoreApiService, useValue: apiSpy },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ScorePreviewComponent);
    return { fixture, component: fixture.componentInstance };
  }

  it('registerAs never defaults to Influencer implicitly — each role routes to its own page', () => {
    const { component } = createComponent();

    component.registerAs('influencer');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/register-influencer']);

    component.registerAs('photographer');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/register-photographer']);

    component.registerAs('brand');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/register-brand']);
  });

  it('shows Creator (Influencer/Photographer) and Brand as equal top-level choices on a non-YouTube tab', () => {
    const { fixture, component } = createComponent();
    component.selectedPlatform = 'instagram';
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.sp-card__role-choice button'));
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Influencer', 'Photographer', 'Brand']);

    buttons[1].click();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/register-photographer']);
  });

  it('shows the same role choice after a YouTube preview result, instead of a single hardcoded Register Free button', () => {
    const { fixture, component } = createComponent();
    component.result = { platform: 'YouTube', handle: '@x', previewScore: 40, confidence: 90, confidenceReason: '' };
    fixture.detectChanges();

    const roleChoice = fixture.nativeElement.querySelector('.sp-card__role-choice');
    expect(roleChoice).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.sp-card__register')).toBeFalsy();
  });
});
