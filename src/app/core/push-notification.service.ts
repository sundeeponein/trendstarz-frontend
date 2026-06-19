import { Injectable, OnDestroy } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';

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

  async hasActiveSubscription(): Promise<boolean> {
    if (!this.swPush.isEnabled) return false;
    const sub = await this.swPush.subscription.pipe(catchError(() => of(null))).toPromise();
    return !!sub;
  }

  /**
   * Fetch VAPID public key, subscribe the browser to push, and POST the
   * subscription object to the backend so it can send notifications later.
   */
  async requestSubscription(userRole: 'brand' | 'influencer' | 'photographer' | 'admin' = 'influencer'): Promise<boolean> {
    if (!this.swPush.isEnabled) return false;

    try {
      this.setLocalPreference('enabled');
      const { key } = await this.http
        .get<{ key: string }>(`${this.apiUrl}/push/vapid-public-key`)
        .toPromise() as { key: string };

      const sub = await this.swPush.requestSubscription({ serverPublicKey: key });

      await this.http
        .post(`${this.apiUrl}/push/subscribe`, { subscription: sub.toJSON(), userRole })
        .pipe(catchError(() => of(null)))
        .toPromise();

      return true;
    } catch (err) {
      console.error('[PushNotificationService] Subscription failed:', err);
      return false;
    }
  }

  /** Cancel the active browser push subscription and notify the backend. */
  async cancelSubscription(): Promise<void> {
    this.setLocalPreference('disabled');
    if (!this.swPush.isEnabled) return;
    try {
      const sub = await this.swPush.subscription.pipe(catchError(() => of(null))).toPromise();
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
