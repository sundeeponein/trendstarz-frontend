import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of, timeout } from 'rxjs';
import { SessionService } from './session.service';
import { ConfigService } from '../shared/config.service';

const APP_SETTINGS_GUARD_TIMEOUT_MS = 5000;

function redirectForRole(role: string): string {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return '/admin/admin-dashboard';
  if (normalized === 'brand') return '/brand-dashboard';
  if (normalized === 'influencer') return '/influencer-dashboard';
  if (normalized === 'photographer') return '/photographer-dashboard';
  return '/';
}

export const guestOnlyGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const config = inject(ConfigService);

  const token = session.getToken();
  const user = session.getUser();
  const isExpired = session.isSessionExpired();

  if (token && user && !isExpired) {
    return router.createUrlTree([redirectForRole(user.role)]);
  }

  return config.getAppSettings().pipe(
    map((settings: any) => {
      const url = state.url || '';
      if (url.includes('/register-influencer') && settings?.showRegisterInfluencerLink === false) {
        return router.createUrlTree(['/']);
      }
      if (url.includes('/register-brand') && settings?.showRegisterBrandLink === false) {
        return router.createUrlTree(['/']);
      }
      if (url.includes('/register-photographer') && settings?.showRegisterPhotographerLink === false) {
        return router.createUrlTree(['/']);
      }
      return true;
    }),
    timeout(APP_SETTINGS_GUARD_TIMEOUT_MS),
    catchError(() => of(true)),
  );
};

export const nonAdminSearchGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  const config = inject(ConfigService);

  const token = session.getToken();
  const user = session.getUser();
  const isExpired = session.isSessionExpired();

  if (token && user && !isExpired && String(user.role || '').toLowerCase() === 'admin') {
    return router.createUrlTree(['/admin/admin-dashboard']);
  }

  return config.getAppSettings().pipe(
    map((settings: any) => {
      if (settings?.showSearchLink === false) {
        return router.createUrlTree(['/']);
      }
      return true;
    }),
    timeout(APP_SETTINGS_GUARD_TIMEOUT_MS),
    catchError(() => of(true)),
  );
};
