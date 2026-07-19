import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { passwordStrengthValidator, getPasswordChecks } from '../../shared/password-strength';
import { finalize } from 'rxjs/operators';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  submitted = false;
  loading = false;
  successMsg = '';
  errorMsg = '';
  token = '';
  firebaseOobCode = '';
  firebaseEmail = '';
  showPassword = false;
  showConfirmPassword = false;
  invalidOrMissingToken = false;
  showStatusModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'success' | 'error' = 'success';
  private readonly invalidLinkMessage = 'This reset link is invalid or expired. If you requested multiple reset emails, use the most recent link or request a new one.';
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private firebaseAuth: FirebaseAuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });
    this.firebaseOobCode = this.resolveFirebaseOobCodeFromUrl();
    this.token = this.firebaseOobCode ? '' : this.resolveTokenFromUrl();
    this.invalidOrMissingToken = !this.token && !this.firebaseOobCode;
    if (this.invalidOrMissingToken) {
      this.errorMsg = this.invalidLinkMessage;
    }
  }

  openStatusModal(title: string, message: string, type: 'success' | 'error' = 'success') {
    this.showStatusModal = true;
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.cdr.detectChanges();
  }

  closeStatusModal() {
    this.showStatusModal = false;
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
    if (this.modalType === 'success') {
      this.router.navigate(['/login']);
    }
  }

  private scheduleRedirect() {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
    this.redirectTimer = setTimeout(() => {
      this.closeStatusModal();
    }, 1800);
  }

  private syncView() {
    this.cdr.detectChanges();
  }

  private resolveResetErrorMessage(message: string): string {
    const normalized = String(message || '').trim();
    if (/invalid|expired/i.test(normalized) && /token|link/i.test(normalized)) {
      return this.invalidLinkMessage;
    }
    return normalized || 'Failed to reset password. Please try again.';
  }

  ngOnInit(): void {
    if (this.firebaseOobCode) {
      this.loading = true;
      this.firebaseAuth.verifyPasswordResetCode(this.firebaseOobCode)
        .then((email) => {
          this.firebaseEmail = email;
          this.invalidOrMissingToken = false;
          this.syncView();
        })
        .catch(() => {
          this.invalidOrMissingToken = true;
          this.errorMsg = this.invalidLinkMessage;
          this.openStatusModal('Reset link unavailable', this.errorMsg, 'error');
          this.syncView();
        })
        .finally(() => {
          this.loading = false;
          this.syncView();
        });
      return;
    }
    if (!this.token) return;
    this.loading = true;
    this.configService.validateResetToken(this.token).pipe(
      finalize(() => {
        this.loading = false;
        this.syncView();
      }),
    ).subscribe({
      next: ({ valid }) => {
        if (!valid) {
          this.invalidOrMissingToken = true;
          this.errorMsg = this.invalidLinkMessage;
          this.openStatusModal('Reset link unavailable', this.errorMsg, 'error');
          this.syncView();
        }
      },
      error: () => {
        // Validation-check failure shouldn't block the form — the real
        // reset-password call will surface the actual error on submit.
      },
    });
  }

  private normalizeParam(value: unknown): string {
    return String(value || '').trim();
  }

  private safeDecode(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private getFromParams(params: URLSearchParams, keys: string[]): string {
    for (const key of keys) {
      const value = this.normalizeParam(params.get(key));
      if (value) return value;
    }
    return '';
  }

  private getFromRawUrl(raw: string, keys: string[]): string {
    const value = this.normalizeParam(raw);
    if (!value) return '';

    const parsedAsQuery = this.getFromParams(
      new URLSearchParams(value.startsWith('?') ? value.slice(1) : value),
      keys,
    );
    if (parsedAsQuery) return parsedAsQuery;

    if (typeof window === 'undefined') return '';

    try {
      const parsed = new URL(value, window.location.origin);
      const fromSearch = this.getFromParams(parsed.searchParams, keys);
      if (fromSearch) return fromSearch;

      const hash = this.normalizeParam(parsed.hash).replace(/^#/, '');
      if (!hash) return '';
      return this.getFromParams(
        new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash),
        keys,
      );
    } catch {
      return '';
    }
  }

  private getFromNestedLinkParams(params: URLSearchParams, keys: string[]): string {
    for (const nestedKey of ['link', 'continueUrl', 'url']) {
      const nested = this.normalizeParam(params.get(nestedKey));
      if (!nested) continue;

      const direct = this.getFromRawUrl(nested, keys);
      if (direct) return direct;

      const decoded = this.safeDecode(nested);
      const decodedResult = this.getFromRawUrl(decoded, keys);
      if (decodedResult) return decodedResult;
    }
    return '';
  }

  private resolveParamFromCurrentUrl(keys: string[]): string {
    if (typeof window === 'undefined') return '';

    const searchParams = new URLSearchParams(window.location.search || '');
    const fromSearch = this.getFromParams(searchParams, keys);
    if (fromSearch) return fromSearch;

    const fromSearchNested = this.getFromNestedLinkParams(searchParams, keys);
    if (fromSearchNested) return fromSearchNested;

    const hash = this.normalizeParam(window.location.hash).replace(/^#/, '');
    if (!hash) return '';

    const hashParams = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
    const fromHash = this.getFromParams(hashParams, keys);
    if (fromHash) return fromHash;

    return this.getFromNestedLinkParams(hashParams, keys);
  }

  private resolveTokenFromUrl(): string {
    const fromQuery = this.normalizeParam(this.route.snapshot.queryParamMap.get('token'));
    if (fromQuery) return fromQuery;

    const fromRouteFallback = this.normalizeParam(this.route.snapshot.queryParamMap.get('resetToken'));
    if (fromRouteFallback) return fromRouteFallback;

    return this.resolveParamFromCurrentUrl(['token', 'resetToken']);
  }

  private resolveFirebaseOobCodeFromUrl(): string {
    const fromRoute = this.normalizeParam(this.route.snapshot.queryParamMap.get('oobCode'));
    if (fromRoute) return fromRoute.replace(/ /g, '+');

    const fromCurrentUrl = this.resolveParamFromCurrentUrl(['oobCode']);
    return fromCurrentUrl ? fromCurrentUrl.replace(/ /g, '+') : '';
  }

  get passwordChecks() {
    return getPasswordChecks(this.resetForm?.get('password')?.value || '');
  }

  passwordsMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit() {
    this.submitted = true;
    this.successMsg = '';
    this.errorMsg = '';
    if (!this.token && !this.firebaseOobCode) {
      this.invalidOrMissingToken = true;
      this.errorMsg = this.invalidLinkMessage;
      this.openStatusModal('Reset link unavailable', this.errorMsg, 'error');
      return;
    }
    if (this.resetForm.invalid) return;
    this.loading = true;
    const password = this.resetForm.get('password')?.value;
    if (this.firebaseOobCode) {
      this.firebaseAuth.completePasswordReset(this.firebaseOobCode, password)
        .then(() => {
          this.successMsg = 'Your password has been reset and your email is verified. You can now log in.';
          this.openStatusModal('Password reset successful', this.successMsg, 'success');
          this.scheduleRedirect();
          this.syncView();
        })
        .catch((err: any) => {
          this.errorMsg = this.resolveResetErrorMessage(
            err?.error?.message || err?.message || '',
          );
          this.openStatusModal('Unable to reset password', this.errorMsg, 'error');
          this.syncView();
        })
        .finally(() => {
          this.loading = false;
          this.syncView();
        });
      return;
    }
    this.configService.resetPassword(this.token, password).pipe(
      finalize(() => {
        this.loading = false;
        this.syncView();
      }),
    ).subscribe({
      next: () => {
        this.successMsg = 'Your password has been reset. You can now log in.';
        this.openStatusModal('Password reset successful', this.successMsg, 'success');
        this.scheduleRedirect();
        this.syncView();
      },
      error: (err: any) => {
        this.errorMsg = this.resolveResetErrorMessage(
          err?.error?.message || err?.message || '',
        );
        this.openStatusModal('Unable to reset password', this.errorMsg, 'error');
        this.syncView();
      }
    });
  }
}
