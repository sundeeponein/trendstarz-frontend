import { Injectable, OnDestroy } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, take, timeout } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { of, Subscription } from 'rxjs';

export interface NotificationPreferences {
  webEnabled: boolean;
  mobileEnabled: boolean;
  campaignEnabled: boolean;
  paymentEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService implements OnDestroy {
  private readonly apiUrl = environment.apiBaseUrl || '/api';
  private readonly preferenceKey = 'notificationPushPreference';
  private msgSub?: Subscription;

  constructor(
    private readonly swPush: SwPush,
    private readonly http: HttpClient,
  ) {}

  get isEnabled(): boolean {
    return this.swPush.isEnabled;
  }

  get localPreference(): 'enabled' | 'disabled' | 'unset' {
    if (typeof localStorage === 'undefined') return 'unset';
    const value = localStorage.getItem(this.preferenceKey);
    return value === 'enabled' || value === 'disabled' ? value : 'unset';
  }

  setLocalPreference(value: 'enabled' | 'disabled'): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.preferenceKey, value);
  }

  get browserPermission(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  /**
   * The browser's current push subscription. swPush.subscription never
   * completes, so take the first value (awaiting toPromise() hung forever —
   * the Settings button stayed on "Saving…").
   */
  private currentSubscription(): Promise<PushSubscription | null> {
    if (!this.swPush.isEnabled) return Promise.resolve(null);
    return firstValueFrom(
      this.swPush.subscription.pipe(take(1), timeout(3000), catchError(() => of(null))),
    ) as Promise<PushSubscription | null>;
  }

  async hasActiveSubscription(): Promise<boolean> {
    return !!(await this.currentSubscription());
  }

  /**
   * Fetch VAPID public key, subscribe the browser to push, and POST the
   * subscription object to the backend so it can send notifications later.
   */
  async requestSubscription(userRole: 'brand' | 'influencer' | 'photographer' | 'admin' = 'influencer'): Promise<boolean> {
    if (!this.swPush.isEnabled) return false;

    try {
      this.setLocalPreference('enabled');
      // The API wraps responses as { success, data: { key } }; reading `.key`
      // at the top level gave the browser an empty key, so it never subscribed.
      const res: any = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/push/vapid-public-key`).pipe(timeout(10000)),
      );
      const key = String(res?.data?.key || res?.key || '');
      if (!key) throw new Error('Push is not configured on the server (no VAPID key).');

      const sub = await this.swPush.requestSubscription({ serverPublicKey: key });

      await firstValueFrom(
        this.http
          .post(`${this.apiUrl}/push/subscribe`, { subscription: sub.toJSON(), userRole })
          .pipe(timeout(10000)),
      );

      return true;
    } catch (err) {
      console.error('[PushNotificationService] Subscription failed:', err);
      return false;
    }
  }

  /**
   * On logout: stop this browser receiving the account's notifications while
   * keeping the browser permission, so the next login re-attaches it. Must run
   * before the session token is cleared (the backend only removes the
   * caller's own subscription). Never blocks logout for more than 3 seconds.
   */
  async detachFromAccount(): Promise<void> {
    if (!this.swPush.isEnabled) return;
    try {
      const sub = await this.currentSubscription();
      if (!sub) return;
      await this.http
        .delete(`${this.apiUrl}/push/unsubscribe`, { body: { endpoint: (sub as PushSubscription).endpoint } })
        .pipe(timeout(3000), catchError(() => of(null)))
        .toPromise();
    } catch { /* silent — logout must still happen */ }
  }

  /** Cancel the active browser push subscription and notify the backend. */
  async cancelSubscription(): Promise<void> {
    this.setLocalPreference('disabled');
    if (!this.swPush.isEnabled) return;
    try {
      const sub = await this.currentSubscription();
      if (sub) {
        const endpoint = (sub as PushSubscription).endpoint;
        await this.http
          .delete(`${this.apiUrl}/push/unsubscribe`, { body: { endpoint } })
          .pipe(catchError(() => of(null)))
          .toPromise();
        await this.swPush.unsubscribe();
      }
    } catch { /* silent */ }
  }

  /** Get the account-level push preference for the logged-in user (device + event category). */
  getPreferences() {
    return this.http
      .get<NotificationPreferences>(`${this.apiUrl}/push/preferences`)
      .pipe(catchError(() => of({ webEnabled: true, mobileEnabled: true, campaignEnabled: true, paymentEnabled: true })));
  }

  /** Update the account-level push preference for the logged-in user (device + event category). */
  updatePreferences(updates: Partial<NotificationPreferences>) {
    return this.http
      .patch<NotificationPreferences>(`${this.apiUrl}/push/preferences`, updates)
      .pipe(catchError(() => of(null)));
  }

  /** Register a handler that shows an in-app toast when a push message arrives. */
  listenForMessages(handler: (payload: any) => void): void {
    this.msgSub = this.swPush.messages.subscribe((msg: unknown) => {
      try {
        handler(typeof msg === 'string' ? JSON.parse(msg) : msg);
      } catch { /* ignore malformed */ }
    });
  }

  ngOnDestroy(): void {
    this.msgSub?.unsubscribe();
  }
}
