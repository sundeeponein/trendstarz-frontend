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

/** Same name the server counts in its own "would block" check (CSP_REPORT_NAME). */
export const CSP_REPORT_NAME = 'CSPReportOnly';

/** "script-src would block https://x.com" — origin only, never the full address. */
export function describeCspViolation(e: { effectiveDirective?: string; violatedDirective?: string; blockedURI?: string; disposition?: string }): string {
  const directive = String(e.effectiveDirective || e.violatedDirective || 'unknown').split(' ')[0];
  const raw = String(e.blockedURI || '');
  let target = raw || 'unknown';
  try {
    if (/^https?:/i.test(raw)) target = new URL(raw).origin;
  } catch { /* keep raw */ }
  const verb = e.disposition === 'enforce' ? 'blocked' : 'would block';
  return `${directive} ${verb} ${target}`.slice(0, 300);
}

/**
 * The website's full security policy runs report-only first (vercel.json).
 * Browsers fire this event for each thing it would block; report each distinct
 * one (at most 10 per page load) so Data health shows what to allow.
 */
export function reportCspViolations(win: Window = window): void {
  const sent = new Set<string>();
  win.document.addEventListener('securitypolicyviolation', (e: SecurityPolicyViolationEvent) => {
    try {
      const message = describeCspViolation(e);
      if (sent.has(message) || sent.size >= 10) return;
      sent.add(message);
      void fetch(`${environment.apiBaseUrl}/client-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          page: win.location.pathname,
          name: CSP_REPORT_NAME,
          message,
          browser: navigator.userAgent.slice(0, 120),
        }),
      }).catch(() => {});
    } catch {
      // Reporting must never throw.
    }
  });
}
