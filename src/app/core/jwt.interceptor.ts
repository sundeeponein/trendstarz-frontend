import { Injectable, Inject, Injector, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SessionService } from './session.service';

/** Why the server ended a session → the code the login page turns into a message. */
export function sessionEndReason(serverMessage: unknown): 'password' | 'deleted' | 'expired' {
  const text = String(serverMessage || '').toLowerCase();
  if (text.includes('password was changed')) return 'password';
  if (text.includes('deleted')) return 'deleted';
  return 'expired';
}

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  /** One redirect per page load — several requests failing together don't stack up. */
  private redirecting = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private injector: Injector,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let token: string | null = null;
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    if (!token) return next.handle(req);

    const cloned = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    return next.handle(cloned).pipe(
      catchError((err: unknown) => {
        // The server refused this signed-in session (password changed elsewhere, account
        // deleted, token expired): sign out here and go to login instead of leaving the
        // page half-loaded. Login/auth calls answer 401 for wrong credentials — leave those.
        if (
          err instanceof HttpErrorResponse &&
          err.status === 401 &&
          !/\/auth\//.test(req.url) &&
          !this.redirecting
        ) {
          this.redirecting = true;
          const reason = sessionEndReason(err.error?.message);
          this.injector.get(SessionService).clearSession();
          this.injector
            .get(Router)
            .navigate(['/login'], { queryParams: { sessionEnded: reason } })
            .finally(() => (this.redirecting = false));
        }
        return throwError(() => err);
      }),
    );
  }
}
