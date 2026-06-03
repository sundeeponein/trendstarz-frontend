import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FirebaseAuthService } from '../../shared/firebase-auth.service';

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

  constructor(private fb: FormBuilder, private firebaseAuth: FirebaseAuthService) {
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
    this.firebaseAuth.sendPasswordReset(email)
      .catch(() => undefined)
      .finally(() => {
        this.successMsg = 'If your email is registered, a reset link has been sent.';
        this.loading = false;
        this.forgotForm.reset();
        this.forgotForm.disable();
      });
  }
}
