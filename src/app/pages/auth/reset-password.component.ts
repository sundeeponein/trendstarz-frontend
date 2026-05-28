import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { passwordStrengthValidator, getPasswordChecks } from '../../shared/password-strength';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent {
  resetForm: FormGroup;
  submitted = false;
  loading = false;
  successMsg = '';
  errorMsg = '';
  token = '';
  showPassword = false;
  showConfirmPassword = false;
  invalidOrMissingToken = false;

  constructor(
    private fb: FormBuilder,
    private configService: ConfigService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });
    this.token = this.resolveTokenFromUrl();
    this.invalidOrMissingToken = !this.token;
    if (this.invalidOrMissingToken) {
      this.errorMsg = 'This reset link is invalid or expired. Please request a new password reset link.';
    }
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
    if (!this.token) {
      this.invalidOrMissingToken = true;
      this.errorMsg = 'This reset link is invalid or expired. Please request a new password reset link.';
      return;
    }
    if (this.resetForm.invalid) return;
    this.loading = true;
    const password = this.resetForm.get('password')?.value;
    this.configService.resetPassword(this.token, password).pipe(
      finalize(() => {
        this.loading = false;
      }),
    ).subscribe({
      next: () => {
        this.successMsg = 'Your password has been reset. You can now log in.';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message || 'Failed to reset password. Please try again.';
      }
    });
  }
}
