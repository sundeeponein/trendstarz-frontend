import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router, provideRouter } from '@angular/router';
import { SessionService } from './core/session.service';
import { routes } from './app.routes';

/**
 * Old campaign links already sent in emails / WhatsApp / notifications
 * (/campaign-management, /influencer-dashboard/campaigns) must reach the
 * campaigns page — via login when the visitor isn't logged in.
 */
describe('app routes — old campaign links', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SessionService,
          useValue: {
            getToken: () => null,
            getUser: () => null,
            isSessionExpired: () => true,
            clearSession: () => {},
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  for (const oldLink of ['/campaign-management', '/influencer-dashboard/campaigns']) {
    it(`${oldLink} → login, then back to /campaigns`, async () => {
      // The login guard on /campaigns starts a second navigation to the login page.
      const redirectedTo = new Promise<string>((resolve) => {
        const sub = router.events.subscribe((e) => {
          if (e instanceof NavigationStart && e.url !== oldLink) {
            sub.unsubscribe();
            resolve(e.url);
          }
        });
      });
      void router.navigateByUrl(oldLink).catch(() => undefined);
      expect(await redirectedTo).toBe('/auth/login?returnUrl=%2Fcampaigns');
    });
  }
});
