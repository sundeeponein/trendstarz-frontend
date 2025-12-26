
import { Injectable } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private static readonly TOKEN_KEY = 'token';
  private static readonly LOGIN_TIME_KEY = 'loginTimestamp';
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms

  private static readonly USER_KEY = 'user';
  private userSubject = new BehaviorSubject<any | null>(null);
  user$ = this.userSubject.asObservable();

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  setToken(token: string) {
    if (!this.isBrowser()) return;
    localStorage.setItem(SessionService.TOKEN_KEY, token);
    localStorage.setItem(SessionService.LOGIN_TIME_KEY, Date.now().toString());
    // Optionally decode user from token here and setUser()
  }

  getToken(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem(SessionService.TOKEN_KEY);
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
    const loginTime = localStorage.getItem(SessionService.LOGIN_TIME_KEY);
    if (!loginTime) return true;
    const now = Date.now();
    return now - parseInt(loginTime, 10) > SessionService.SESSION_TIMEOUT;
  }

  clearSession() {
    if (!this.isBrowser()) return;
    localStorage.removeItem(SessionService.TOKEN_KEY);
    localStorage.removeItem(SessionService.LOGIN_TIME_KEY);
    localStorage.removeItem(SessionService.USER_KEY);
    this.userSubject.next(null);
  }
}
