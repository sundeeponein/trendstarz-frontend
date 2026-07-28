import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CollaborationScoreApiService } from '../../services/collaboration-score-api.service';
import { ScorePreviewComponent } from './score-preview.component';

describe('ScorePreviewComponent — role-choice CTA', () => {
  let routerSpy: jasmine.SpyObj<Router>;
  let apiSpy: jasmine.SpyObj<CollaborationScoreApiService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    apiSpy = jasmine.createSpyObj<CollaborationScoreApiService>('CollaborationScoreApiService', [
      'previewFromYoutubeUrl',
      'getPlatformFlags',
    ]);
    apiSpy.previewFromYoutubeUrl.and.returnValue(of({} as any));
    apiSpy.getPlatformFlags.and.returnValue(
      of({ platformsEnabled: { instagram: true, facebook: true, youtube: true, linkedin: true } }),
    );

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

  describe('admin platform toggles', () => {
    it('hides a tab an admin has disabled in Collaboration Score Settings', () => {
      apiSpy.getPlatformFlags.and.returnValue(
        of({ platformsEnabled: { instagram: false, facebook: true, youtube: true, linkedin: true } }),
      );
      const { fixture } = createComponent();

      fixture.detectChanges();

      const tabLabels: string[] = Array.from(fixture.nativeElement.querySelectorAll('.sp-card__platform-tab')).map(
        (el: any) => el.textContent.trim(),
      );
      expect(tabLabels).not.toContain('Instagram');
      expect(tabLabels).toEqual(['Facebook', 'YouTube', 'LinkedIn']);
    });

    it('moves off a tab that gets disabled out from under the visitor currently on it', () => {
      apiSpy.getPlatformFlags.and.returnValue(
        of({ platformsEnabled: { instagram: true, facebook: true, youtube: false, linkedin: true } }),
      );
      const { component, fixture } = createComponent();
      component.selectedPlatform = 'youtube';

      fixture.detectChanges();

      expect(component.selectedPlatform).not.toBe('youtube');
      expect(component.platformsEnabled.youtube).toBe(false);
    });

    it('keeps every tab visible (fails open) if the flags request errors', () => {
      apiSpy.getPlatformFlags.and.returnValue(throwError(() => new Error('network down')));
      const { fixture, component } = createComponent();

      fixture.detectChanges();

      expect(component.visiblePlatforms.length).toBe(4);
    });
  });
});
