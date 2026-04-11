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

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMsg = '';
  submitted = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private session: SessionService,
    private configService: ConfigService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    this.errorMsg = '';
    this.submitted = true;
    Object.values(this.loginForm.controls).forEach(control => control.markAsTouched());
    if (this.loginForm.invalid) return;
    this.http.post(`${environment.apiBaseUrl}/auth/login`, this.loginForm.value)
      .pipe(timeout(5000), catchError(err => {
        if (err?.error?.message?.includes('pending')) {
          this.errorMsg = 'Your account is pending approval. Please wait for admin to activate your account.';
        } else {
          this.errorMsg = err?.error?.message || 'Login failed';
        }
        return of(null);
      }))
      .subscribe((res: any) => {
        if (!res) return;
        this.session.setToken(res.token);
        if (res.user) {
          this.session.setUser(res.user);
        }
        if (res.userType === 'admin') {
          this.router.navigate(['/admin']);
        } else if (res.userType === 'brand') {
          this.configService.getBrandProfileById().subscribe({
            next: (profile: any) => {
              if (!profile || !profile._id) {
                // If backend just created a minimal profile, allow login and redirect to profile completion
                this.router.navigate(['/brand-profile']);
                return;
              }
              // Merge profile into session user
              const user = { ...res.user, ...profile, brandId: profile._id };
              this.session.setUser(user);
              // If profile is minimal (missing required fields), redirect to profile completion
              if (!profile.brandName || !profile.email) {
                this.router.navigate(['/brand-profile']);
              } else {
                this.router.navigate(['/brand-dashboard']);
              }
            },
            error: () => {
              this.errorMsg = 'Failed to load brand profile. Please try again.';
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
