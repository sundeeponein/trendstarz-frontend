import { ApplicationRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

/**
 * The app runs without zone.js, so a page that changes a field in an HTTP callback
 * isn't redrawn until something else triggers it — the admin code box never appeared
 * and buttons stayed on "Signing in…" (2026-10-26); 14 pages had the same pattern.
 * After every response (success or error), once the page's own callbacks have run,
 * redraw the app — what zone.js used to do. Pages that redraw themselves are unaffected.
 */
@Injectable()
export class RedrawAfterHttpInterceptor implements HttpInterceptor {
  private readonly appRef = inject(ApplicationRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pending = false;

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isBrowser) return next.handle(req);
    return next.handle(req).pipe(finalize(() => this.scheduleRedraw()));
  }

  /** One redraw per burst of responses, after the subscribers' callbacks. */
  private scheduleRedraw(): void {
    if (this.pending) return;
    this.pending = true;
    setTimeout(() => {
      this.pending = false;
      try {
        this.appRef.tick();
      } catch {
        // A redraw error is reported by Angular's ErrorHandler; never break the response.
      }
    });
  }
}
