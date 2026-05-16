
import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService {
  constructor() {
    this.loadUserFromStorage();
  }
  private static readonly TOKEN_KEY = 'token';
  private static readonly LOGIN_TIME_KEY = 'loginTimestamp';
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms
  private static readonly REMEMBER_ME_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  private static readonly USER_KEY = 'user';
  private userSubject = new BehaviorSubject<any | null>(null);
  user$ = this.userSubject.asObservable();

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  prefersPersistentSession(): boolean {
    if (!this.isBrowser()) return false;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any)?.standalone === true;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    return standalone || isMobile;
  }

  private isRememberedSessionValid(): boolean {
    const savedAt = localStorage.getItem(SessionService.LOGIN_TIME_KEY);
    if (!savedAt) return false;
    const timestamp = Number(savedAt);
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp < SessionService.REMEMBER_ME_DURATION;
  }

  private clearRememberedSession(): void {
    localStorage.removeItem(SessionService.TOKEN_KEY);
    localStorage.removeItem(SessionService.LOGIN_TIME_KEY);
  }

  setToken(token: string, rememberMe = false) {
    if (!this.isBrowser()) return;
    if (rememberMe) {
      localStorage.setItem(SessionService.TOKEN_KEY, token);
      localStorage.setItem(SessionService.LOGIN_TIME_KEY, String(Date.now()));
      sessionStorage.removeItem(SessionService.TOKEN_KEY);
    } else {
      this.clearRememberedSession();
      sessionStorage.setItem(SessionService.TOKEN_KEY, token);
    }
  }

  getToken(): string | null {
    if (!this.isBrowser()) return null;
    const rememberedToken = localStorage.getItem(SessionService.TOKEN_KEY);
    if (rememberedToken) {
      if (this.isRememberedSessionValid()) return rememberedToken;
      this.clearRememberedSession();
    }
    return sessionStorage.getItem(SessionService.TOKEN_KEY);
  }

  setUser(user: any) {
    if (!this.isBrowser()) return;
    localStorage.setItem(SessionService.USER_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  getUser(): any | null {
    if (!this.isBrowser()) return null;
    const userStr = localStorage.getItem(SessionService.USER_KEY);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  loadUserFromStorage() {
    let user = this.getUser();
    if (!user) {
      // Try to decode user from JWT token if present
      const token = this.getToken();
      if (token && token !== 'undefined' && token !== '') {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          // Use standard JWT fields or your custom fields
          user = {
            id: payload.userId || payload.id,
            email: payload.email,
            role: payload.role,
            name: payload.name || 'Admin',
            // Add more fields if needed
          };
          this.setUser(user); // Save to localStorage and update subject
        } catch (e) {
          // If decoding fails, just set user to null
          user = null;
        }
      }
    }
    this.userSubject.next(user);
  }

  isSessionExpired(): boolean {
    if (!this.isBrowser()) return false; // Always valid on server
    const token = this.getToken();
    if (!token || token === 'undefined' || token === '') return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return false; // No expiry claim → treat as valid
      return Date.now() >= payload.exp * 1000; // exp is in seconds
    } catch {
      return true;
    }
  }

  clearSession() {
    if (!this.isBrowser()) return;
    localStorage.removeItem(SessionService.TOKEN_KEY);
    sessionStorage.removeItem(SessionService.TOKEN_KEY);
    localStorage.removeItem(SessionService.LOGIN_TIME_KEY);
    localStorage.removeItem(SessionService.USER_KEY);
    this.userSubject.next(null);
  }
}
