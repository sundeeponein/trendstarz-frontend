
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);

  const token = session.getToken();
  const user = session.getUser();
  const isExpired = session.isSessionExpired();

  if (!token || !user || isExpired) {
    session.clearSession();
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url || '/' },
    });
  }

  // Protect all /admin routes from non-admin roles.
  if ((state.url || '').startsWith('/admin') && String(user.role || '').toLowerCase() !== 'admin') {
    return router.createUrlTree(['/auth/login']);
  }

  return true;
};
