import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RegistrationConfirmModalComponent } from '../../shared/components/registration-confirm-modal/registration-confirm-modal.component';
import { RegistrationConfirmModalService } from '../../shared/components/registration-confirm-modal/registration-confirm-modal.service';
import { VisibilityPromptModalComponent } from '../../shared/components/visibility-prompt-modal/visibility-prompt-modal.component';
import { ProfileVisibility } from '../../shared/config.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, RegistrationConfirmModalComponent, VisibilityPromptModalComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  readonly regConfirm = inject(RegistrationConfirmModalService);

  showVisibilityPrompt = false;
  visibilityPromptBusy = false;
  private pendingUserType = '';

  loginForm: FormGroup;
  submitted = false;
  loggingIn = false;
  showPassword = false;
  emailNotVerified = false;
  resendingVerification = false;
  resendVerificationSuccess = false;
  resendVerificationError: string | null = null;
  changingEmail = false;
  private unverifiedEmail = '';
  /** Where to send the user after login instead of their role dashboard, e.g. /login?returnUrl=/upgrade-premium */
  private returnUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private session: SessionService,
    private configService: ConfigService,
    private firebaseAuth: FirebaseAuthService,
    private toast: ToastService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    // Only honor app-internal paths — never an absolute/external URL.
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    if (requested && requested.startsWith('/') && !requested.startsWith('//')) {
      this.returnUrl = requested;
    }

    this.loginForm.valueChanges.subscribe(() => {
      if (this.submitted) this.submitted = false;
      if (this.emailNotVerified) {
        this.emailNotVerified = false;
        this.resendVerificationSuccess = false;
        this.resendVerificationError = null;
      }
    });
  }

  async onSubmit() {
    this.submitted = true;
    Object.values(this.loginForm.controls).forEach(control => control.markAsTouched());
    if (this.loginForm.invalid) return;
    this.loggingIn = true;
    const { email, password } = this.loginForm.value;
    let firebaseIdToken: string | null = null;
    try {
      firebaseIdToken = await this.firebaseAuth.getVerifiedLoginIdToken(email, password);
    } catch (error: any) {
      const code = String(error?.code || '');
      if (code !== 'auth/invalid-credential' && code !== 'auth/wrong-password' && code !== 'auth/user-not-found') {
        this.toast.error(this.firebaseAuth.getFirebaseAuthErrorMessage(error));
      }
    }
    const loginPayload = {
      ...this.loginForm.value,
      ...(firebaseIdToken ? { firebaseIdToken } : {}),
    };
    this.http.post(`${environment.apiBaseUrl}/auth/login`, loginPayload)
      .pipe(timeout(5000), catchError(err => {
        this.loggingIn = false;
        const msg: string = err?.error?.message || '';
        if (msg.toLowerCase().includes('pending')) {
          this.toast.warning(
            "Your account is awaiting admin verification. We'll notify you once it's approved.",
            6000,
          );
        } else if (
          msg.toLowerCase().includes('not verified') ||
          msg.toLowerCase().includes('email is not verified') ||
          msg.toLowerCase().includes('verify your email') ||
          msg.toLowerCase().includes('firebase verification is required')
        ) {
          this.unverifiedEmail = this.loginForm.value.email || '';
          this.emailNotVerified = true;
          this.resendVerificationSuccess = false;
          this.resendVerificationError = null;
        } else {
          this.toast.error(msg || 'Login failed. Please check your details and try again.');
        }
        return of(null);
      }))
      .subscribe((res: any) => {
        if (!res) return;
        this.session.setToken(res.token);
        if (res.user) {
          this.session.setUser(res.user);
        }

        if (res.accountDeletionPending) {
          this.router.navigate(['/account-deletion-pending']);
          return;
        }

        const userType = String(res.userType || res.user?.role || '').toLowerCase();

        if (userType === 'admin') {
          this.router.navigate(['/admin']);
          return;
        }

        // Pre-existing accounts that never explicitly chose a profile
        // visibility get asked once per login, instead of silently staying
        // on the PUBLIC display default forever.
        const userId = res.user?.id;
        if (userId) {
          this.pendingUserType = userType;
          this.configService.getProfileVisibility(userId).subscribe({
            next: (visRes) => {
              if (!visRes?.isSet) {
                this.showVisibilityPrompt = true;
                return;
              }
              this.proceedToDashboard(userType);
            },
            error: () => this.proceedToDashboard(userType),
          });
        } else {
          this.proceedToDashboard(userType);
        }
      });
  }

  private proceedToDashboard(userType: string): void {
    if (userType === 'brand') {
      this.configService.getBrandProfileById().subscribe({
        next: (profile: any) => {
          // Merge profile into session user
          const currentUser = this.session.getUser();
          const user = { ...currentUser, ...(profile || {}), brandId: profile?._id || currentUser?._id };
          this.session.setUser(user);
          // Always redirect to brand-dashboard; user can complete profile from there
          this.router.navigateByUrl(this.returnUrl || '/brand-dashboard');
        },
        error: () => {
          // Even on error, go to dashboard (dashboard will show profile incomplete banner)
          this.router.navigateByUrl(this.returnUrl || '/brand-dashboard');
        }
      });
    } else if (userType === 'influencer') {
      this.router.navigateByUrl(this.returnUrl || '/influencer-dashboard');
    } else if (userType === 'photographer') {
      this.router.navigateByUrl(this.returnUrl || '/photographer-dashboard');
    } else {
      this.router.navigate(['/']);
    }
  }

  onVisibilityChosen(value: ProfileVisibility): void {
    const userId = this.session.getUser()?.id;
    if (!userId) {
      this.showVisibilityPrompt = false;
      this.proceedToDashboard(this.pendingUserType);
      return;
    }
    this.visibilityPromptBusy = true;
    this.configService.updateProfileVisibility(userId, value).subscribe({
      next: () => {
        this.visibilityPromptBusy = false;
        this.showVisibilityPrompt = false;
        this.proceedToDashboard(this.pendingUserType);
      },
      error: () => {
        this.visibilityPromptBusy = false;
        this.showVisibilityPrompt = false;
        this.proceedToDashboard(this.pendingUserType);
      },
    });
  }

  onVisibilitySkipped(): void {
    this.showVisibilityPrompt = false;
    this.proceedToDashboard(this.pendingUserType);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  resendVerificationEmail() {
    const email = this.unverifiedEmail || this.loginForm.value.email;
    if (!email) return;
    this.resendingVerification = true;
    this.resendVerificationSuccess = false;
    this.resendVerificationError = null;
    this.configService.sendEmailVerificationLink(email).subscribe({
      next: () => {
        this.resendingVerification = false;
        this.resendVerificationSuccess = true;
      },
      error: (err: any) => {
        this.resendingVerification = false;
        this.resendVerificationError = err?.error?.message || 'Failed to resend verification email.';
      }
    });
  }

  changeEmailForVerification() {
    this.emailNotVerified = false;
    this.resendVerificationSuccess = false;
    this.resendVerificationError = null;
    this.unverifiedEmail = '';
    this.loginForm.get('email')?.setValue('');
    this.loginForm.get('password')?.setValue('');
  }
}
