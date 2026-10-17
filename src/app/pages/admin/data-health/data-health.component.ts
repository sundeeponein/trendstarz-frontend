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
  error = '';
  run: IntegrityRun | null = null;
  private readonly isBrowser: boolean;
  private readonly url = `${environment.apiBaseUrl}/admin/data-integrity`;

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
