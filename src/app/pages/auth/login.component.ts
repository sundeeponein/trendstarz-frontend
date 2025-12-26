import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SessionService } from '../../core/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './login.component.html',
  // styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMsg = '';

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router, private session: SessionService) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
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
        // Save user info for reactive use
        if (res.user) {
          this.session.setUser(res.user);
        } else {
          // fallback: try to decode from token if needed
        }
        if (res.userType === 'admin') {
          this.router.navigate(['/admin']);
        } else if (res.userType === 'brand') {
          this.router.navigate(['/brand-profile']);
        } else if (res.userType === 'influencer') {
          this.router.navigate(['/influencer-profile']);
        } else {
          this.router.navigate(['/']);
        }
      });
  }
}
