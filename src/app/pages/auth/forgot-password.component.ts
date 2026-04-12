import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';

import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  submitted = false;
  loading = false;
  successMsg = '';
  errorMsg = '';

  constructor(private fb: FormBuilder, private configService: ConfigService) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit() {
    this.submitted = true;
    this.successMsg = '';
    this.errorMsg = '';
    if (this.forgotForm.invalid) return;
    this.loading = true;
    const email = this.forgotForm.get('email')?.value;
    this.configService.sendForgotPasswordLink(email).subscribe({
      next: (res: any) => {
        this.successMsg = 'If your email is registered and verified, a reset link has been sent.';
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMsg = err?.error?.message || 'Failed to send reset link. Please try again.';
        this.loading = false;
      }
    });
  }
}
