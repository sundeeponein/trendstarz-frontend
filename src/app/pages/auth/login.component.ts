import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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

  constructor(private fb: FormBuilder, private http: HttpClient, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) return;
    this.http.post(`${environment.apiBaseUrl}/auth/login`, this.loginForm.value)
      .pipe(timeout(5000), catchError(err => { this.errorMsg = err?.error?.message || 'Login failed'; console.error('login failed', err); return of(null); }))
      .subscribe((res: any) => {
        if (!res) return;
        localStorage.setItem('token', res.token);
        if (res.userType === 'admin') {
          this.router.navigate(['/']).then(() => {
            this.router.navigate(['/admin']);
          });
        } else {
          this.router.navigate(['/']);
        }
      });
  }
}
