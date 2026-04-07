import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { catchError, timeout } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WarmupService {
  /** Resolves when the backend has responded (or failed) — shared across all components */
  readonly ready: Promise<void>;
  private resolveReady!: () => void;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.ready = new Promise(resolve => { this.resolveReady = resolve; });

    if (!isPlatformBrowser(this.platformId)) {
      this.resolveReady();
      return;
    }

    this.http
      .get(`${environment.apiBaseUrl}/health`)
      .pipe(timeout(60000), catchError(() => of(null)))
      .subscribe(() => this.resolveReady());
  }
}
