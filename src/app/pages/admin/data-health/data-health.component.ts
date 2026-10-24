import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface IntegrityCheck {
  key: string;
  label: string;
  status: 'ok' | 'warn';
  count: number;
  help: string;
  samples: string[];
  refs?: string[];
  explained?: number;
}

interface ConfigCheck {
  service: string;
  status: 'working' | 'missing' | 'failing' | 'off';
  detail: string;
}

interface IntegrityRun {
  ranAt: string;
  trigger: 'nightly' | 'admin';
  warnCount: number;
  checks: IntegrityCheck[];
}

/** Admin "Data health": the nightly data-integrity checks (backend data-integrity module). */
@Component({
  selector: 'app-data-health',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './data-health.component.html',
  styleUrls: ['./data-health.component.scss'],
})
export class DataHealthComponent implements OnInit {
  loading = false;
  running = false;
  explaining = '';
  error = '';
  run: IntegrityRun | null = null;
  private readonly isBrowser: boolean;
  private readonly url = `${environment.apiBaseUrl}/admin/data-integrity`;
  /** Service settings check (keys present and working) — loaded on request: it calls each service. */
  configChecks: ConfigCheck[] | null = null;
  configLoading = false;
  configError = '';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) this.load();
  }

  get warnings(): IntegrityCheck[] {
    return (this.run?.checks || []).filter((c) => c.status === 'warn');
  }

  get passing(): IntegrityCheck[] {
    return (this.run?.checks || []).filter((c) => c.status === 'ok');
  }

  checkConfig(): void {
    this.configLoading = true;
    this.configError = '';
    this.http.get<any>(`${environment.apiBaseUrl}/health/config`).subscribe({
      next: (res) => {
        this.configChecks = (res?.data ?? res)?.checks || [];
        this.configLoading = false;
      },
      error: (err) => {
        this.configLoading = false;
        this.configError = err?.error?.message || 'Failed to check the service settings.';
      },
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<any>(this.url).subscribe({
      next: (res) => {
        this.run = res?.data ?? res;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load the data checks.';
      },
    });
  }

  /** Records why a flagged record is fine; the check stops counting it (the record itself is unchanged). */
  explain(check: IntegrityCheck, index: number): void {
    const ref = check.refs?.[index];
    if (!ref) return;
    const reason = window.prompt(
      `Why is this OK?\n${check.samples[index]}\n\n(e.g. "Paid outside the app during early testing, June 2026")`,
    );
    if (reason === null) return;
    this.explaining = ref;
    this.error = '';
    this.http.post<any>(`${this.url}/explain`, { check: check.key, ref, reason }).subscribe({
      next: (res) => {
        this.run = res?.data ?? res;
        this.explaining = '';
      },
      error: (err) => {
        this.explaining = '';
        this.error = err?.error?.message || 'Could not save the explanation.';
      },
    });
  }

  runNow(): void {
    this.running = true;
    this.error = '';
    this.http.post<any>(`${this.url}/run`, {}).subscribe({
      next: (res) => {
        this.run = res?.data ?? res;
        this.running = false;
      },
      error: (err) => {
        this.running = false;
        this.error = err?.error?.message || 'The checks could not run.';
      },
    });
  }
}
