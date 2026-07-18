import { Component, OnInit } from '@angular/core';
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
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private firebaseAuth: FirebaseAuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });
    this.firebaseOobCode = this.resolveFirebaseOobCodeFromUrl();
    this.token = this.firebaseOobCode ? '' : this.resolveTokenFromUrl();
    this.invalidOrMissingToken = !this.token && !this.firebaseOobCode;
    if (this.invalidOrMissingToken) {
      this.errorMsg = 'This reset link is invalid or expired. Please request a new password reset link.';
    }
  }

  openStatusModal(title: string, message: string, type: 'success' | 'error' = 'success') {
    this.showStatusModal = true;
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
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

  ngOnInit(): void {
    if (this.firebaseOobCode) {
      this.loading = true;
      this.firebaseAuth.verifyPasswordResetCode(this.firebaseOobCode)
        .then((email) => {
          this.firebaseEmail = email;
          this.invalidOrMissingToken = false;
        })
        .catch(() => {
          this.invalidOrMissingToken = true;
          this.errorMsg = 'This reset link is invalid or expired. Please request a new password reset link.';
          this.openStatusModal('Reset link unavailable', this.errorMsg, 'error');
        })
        .finally(() => {
          this.loading = false;
        });
      return;
    }
    if (!this.token) return;
    this.loading = true;
    this.configService.validateResetToken(this.token).pipe(
      finalize(() => {
        this.loading = false;
      }),
    ).subscribe({
      next: ({ valid }) => {
        if (!valid) {
          this.invalidOrMissingToken = true;
          this.errorMsg = 'This reset link is invalid or expired. Please request a new password reset link.';
          this.openStatusModal('Reset link unavailable', this.errorMsg, 'error');
        }
      },
      error: () => {
        // Validation-check failure shouldn't block the form — the real
        // reset-password call will surface the actual error on submit.
      },
    });
  }

  private resolveTokenFromUrl(): string {
    const fromQuery = String(this.route.snapshot.queryParamMap.get('token') || '').trim();
    if (fromQuery) return fromQuery;

    if (typeof window === 'undefined') return '';
    const hash = String(window.location.hash || '').replace(/^#/, '');
    if (!hash) return '';
    const params = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
    return String(params.get('token') || '').trim();
  }

  private resolveFirebaseOobCodeFromUrl(): string {
    const mode = String(this.route.snapshot.queryParamMap.get('mode') || '').trim();
    const fromQuery = String(this.route.snapshot.queryParamMap.get('oobCode') || '').trim();
    if (mode === 'resetPassword' && fromQuery) return fromQuery;

    if (typeof window === 'undefined') return '';
    const hash = String(window.location.hash || '').replace(/^#/, '');
    if (!hash) return '';
    const params = new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash);
    const hashMode = String(params.get('mode') || '').trim();
    const fromHash = String(params.get('oobCode') || '').trim();
    return hashMode === 'resetPassword' ? fromHash : '';
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
      this.errorMsg = 'This reset link is invalid or expired. Please request a new password reset link.';
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
        })
        .catch((err: any) => {
          this.errorMsg = err?.error?.message || err?.message || 'Failed to reset password. Please try again.';
          this.openStatusModal('Unable to reset password', this.errorMsg, 'error');
        })
        .finally(() => {
          this.loading = false;
        });
      return;
    }
    this.configService.resetPassword(this.token, password).pipe(
      finalize(() => {
        this.loading = false;
      }),
    ).subscribe({
      next: () => {
        this.successMsg = 'Your password has been reset. You can now log in.';
        this.openStatusModal('Password reset successful', this.successMsg, 'success');
        this.scheduleRedirect();
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message || 'Failed to reset password. Please try again.';
        this.openStatusModal('Unable to reset password', this.errorMsg, 'error');
      }
    });
  }
}
