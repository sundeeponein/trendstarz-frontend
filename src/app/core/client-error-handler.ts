import { ErrorHandler, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Errors in the page itself only reached the user's own console. This keeps
 * Angular's default logging and also reports a short record (page path, error
 * name and message, browser) so a broken screen shows on Data health. At most
 * 5 reports per page load, no repeats; fetch (not HttpClient) so a failing
 * report can never loop back into this handler.
 */
/** Harmless messages that aren't our bugs (same list as the server's CLIENT_ERROR_NOISE). */
const NOISE = [/Java object is gone/i, /^Script error\.?$/i];

@Injectable()
export class ClientErrorHandler extends ErrorHandler {
  private sent = new Set<string>();

  override handleError(error: any): void {
    super.handleError(error);
    try {
      if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
      const err = error?.rejection || error?.originalError || error;
      const message = String(err?.message || err || '').slice(0, 300);
      const name = String(err?.name || 'Error').slice(0, 60);
      const key = `${name}:${message}`;
      if (!message || NOISE.some((re) => re.test(message.trim()))) return;
      if (this.sent.has(key) || this.sent.size >= 5) return;
      this.sent.add(key);
      void fetch(`${environment.apiBaseUrl}/client-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          page: window.location.pathname,
          name,
          message,
          browser: navigator.userAgent.slice(0, 120),
        }),
      }).catch(() => {});
    } catch {
      // Reporting must never throw.
    }
  }
}
