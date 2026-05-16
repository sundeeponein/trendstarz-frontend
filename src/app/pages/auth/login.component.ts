import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { ToastService } from '../../shared/toast/toast.service';

import { FooterComponent } from '../../shared/footer/footer.component';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, FooterComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  submitted = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private session: SessionService,
    private configService: ConfigService,
    private toast: ToastService,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [this.session.prefersPersistentSession()],
    });

    // Reset “submitted” flag when the user starts editing again so any
    // field-level hints disappear until they press Sign In once more.
    this.loginForm.valueChanges.subscribe(() => {
      if (this.submitted) this.submitted = false;
    });
  }

  onSubmit() {
    this.submitted = true;
    Object.values(this.loginForm.controls).forEach(control => control.markAsTouched());
    if (this.loginForm.invalid) return;
    this.http.post(`${environment.apiBaseUrl}/auth/login`, this.loginForm.value)
      .pipe(timeout(5000), catchError(err => {
        if (err?.error?.message?.includes('pending')) {
          this.toast.warning(
            'Your account is awaiting admin verification. We’ll notify you once it’s approved.',
            6000,
          );
        } else {
          this.toast.error(err?.error?.message || 'Login failed. Please check your details and try again.');
        }
        return of(null);
      }))
      .subscribe((res: any) => {
        if (!res) return;
        const rememberMe = !!this.loginForm.get('rememberMe')?.value;
        this.session.setToken(res.token, rememberMe);
        if (res.user) {
          this.session.setUser(res.user);
        }
        if (res.userType === 'admin') {
          this.router.navigate(['/admin']);
        } else if (res.userType === 'brand') {
          this.configService.getBrandProfileById().subscribe({
            next: (profile: any) => {
              // Merge profile into session user
              const user = { ...res.user, ...(profile || {}), brandId: profile?._id || res.user?._id };
              this.session.setUser(user);
              // Always redirect to brand-dashboard; user can complete profile from there
              this.router.navigate(['/brand-dashboard']);
            },
            error: () => {
              // Even on error, go to dashboard (dashboard will show profile incomplete banner)
              this.router.navigate(['/brand-dashboard']);
            }
          });
        } else if (res.userType === 'influencer') {
          this.router.navigate(['/influencer-dashboard']);
        } else {
          this.router.navigate(['/']);
        }
      });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}
