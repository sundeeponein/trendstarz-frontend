import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';

import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
    if (this.forgotForm.invalid) {
      this.errorMsg = 'Please enter a valid email address.';
      return;
    }
    this.loading = true;
    const email = this.forgotForm.get('email')?.value;
    this.configService.sendForgotPasswordLink(email).subscribe({
      next: () => {
        this.successMsg = 'If your email is registered, you’ll receive a password reset link shortly. Please check your Inbox, Spam, or Promotions folder.';
        this.loading = false;
        this.forgotForm.reset();
        this.forgotForm.disable();
      },
      error: () => {
        this.successMsg = 'If your email is registered, you’ll receive a password reset link shortly. Please check your Inbox, Spam, or Promotions folder.';
        this.loading = false;
        this.forgotForm.reset();
        this.forgotForm.disable();
      }
    });
  }
}
