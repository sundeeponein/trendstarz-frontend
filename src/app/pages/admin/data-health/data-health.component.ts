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
  /** Nightly encrypted database backups. */
  backups: { configured: boolean; runs: any[]; files: any[] } | null = null;
  backupBusy = false;
  backupError = '';
  /** Razorpay vs TrendStarZ (captured payments that were never completed here). */
  recon: { days: number; checked: number; recorded: number; notRecorded: any[]; unknownOrder: any[] } | null = null;
  reconLoading = false;
  reconError = '';
  configLoading = false;
  configError = '';
  /** Firebase logins vs TrendStarZ accounts. */
  fbRecon: {
    firebaseUsers: number;
    accounts: number;
    noFirebaseLogin: any[];
    linkedToOtherLogin: any[];
    deletedButLoginKept: any[];
    loginWithoutAccount: any[];
    verifiedOnlyInFirebase: any[];
  } | null = null;
  fbReconLoading = false;
  fbReconError = '';
  /** Live accounts whose email Brevo refuses (bounced, spam complaint, unsubscribed). */
  emailBlocks: { blockedInBrevo: number; accounts: any[] } | null = null;
  emailBlocksLoading = false;
  emailBlocksError = '';

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.load();
      this.loadBackups();
    }
  }

  get warnings(): IntegrityCheck[] {
    return (this.run?.checks || []).filter((c) => c.status === 'warn');
  }

  get passing(): IntegrityCheck[] {
    return (this.run?.checks || []).filter((c) => c.status === 'ok');
  }

  reconcileRazorpay(days = 14): void {
    this.reconLoading = true;
    this.reconError = '';
    this.http.get<any>(`${this.url}/razorpay-reconcile`, { params: { days } }).subscribe({
      next: (res) => {
        const body = res?.data ?? res;
        this.recon = body?.data ?? body;
        this.reconLoading = false;
      },
      error: (err) => {
        this.reconLoading = false;
        this.reconError = err?.error?.message || 'Failed to compare with Razorpay.';
      },
    });
  }

  checkEmailBlocks(): void {
    this.emailBlocksLoading = true;
    this.emailBlocksError = '';
    this.http.get<any>(`${this.url}/email-blocks`).subscribe({
      next: (res) => {
        const body = res?.data ?? res;
        this.emailBlocks = body?.data ?? body;
        this.emailBlocksLoading = false;
      },
      error: (err) => {
        this.emailBlocksLoading = false;
        this.emailBlocksError = err?.error?.message || 'Failed to read Brevo\'s blocked list.';
      },
    });
  }

  reconcileFirebase(): void {
    this.fbReconLoading = true;
    this.fbReconError = '';
    this.http.get<any>(`${this.url}/firebase-reconcile`).subscribe({
      next: (res) => {
        const body = res?.data ?? res;
        this.fbRecon = body?.data ?? body;
        this.fbReconLoading = false;
      },
      error: (err) => {
        this.fbReconLoading = false;
        this.fbReconError = err?.error?.message || 'Failed to compare with Firebase.';
      },
    });
  }

  /** Lists that need action (the "no Firebase login yet" list is information only). */
  get fbProblems(): Array<{ label: string; tone: string; rows: any[] }> {
    const r = this.fbRecon;
    if (!r) return [];
    return [
      { label: 'Linked to another login', tone: 'failing', rows: r.linkedToOtherLogin },
      { label: 'Deleted, login kept', tone: 'failing', rows: r.deletedButLoginKept },
      { label: 'Login, no account', tone: 'off', rows: r.loginWithoutAccount },
      { label: 'Verified only in Firebase', tone: 'off', rows: r.verifiedOnlyInFirebase },
    ].filter((g) => g.rows.length);
  }

  loadBackups(): void {
    this.http.get<any>(`${this.url}/backups`).subscribe({
      next: (res) => {
        const body = res?.data ?? res;
        this.backups = body?.data ?? body;
      },
      error: () => (this.backups = null),
    });
  }

  backupNow(): void {
    this.backupBusy = true;
    this.backupError = '';
    this.http.post<any>(`${this.url}/backups/run`, {}).subscribe({
      next: () => {
        this.backupBusy = false;
        this.loadBackups();
      },
      error: (err) => {
        this.backupBusy = false;
        this.backupError = err?.error?.message || 'Backup failed.';
        this.loadBackups();
      },
    });
  }

  verifyBusy = false;

  /** Restore test: the newest backup is downloaded and read back in full on the server. */
  testRestore(): void {
    this.verifyBusy = true;
    this.backupError = '';
    this.http.post<any>(`${this.url}/backups/verify`, {}).subscribe({
      next: () => {
        this.verifyBusy = false;
        this.loadBackups();
      },
      error: (err) => {
        this.verifyBusy = false;
        this.backupError = err?.error?.message || 'Restore test failed.';
        this.loadBackups();
      },
    });
  }

  get lastRestoreTest(): any {
    return (this.backups?.runs || []).find((r: any) => r.kind === 'verify') || null;
  }

  get lastGoodBackup(): any {
    return (this.backups?.runs || []).find((r: any) => r.status === 'ok') || null;
  }

  formatKb(bytes: number): string {
    return `${Math.max(1, Math.round(Number(bytes || 0) / 1024))} KB`;
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
