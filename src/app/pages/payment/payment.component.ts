import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss']
})
export class PaymentComponent {
  paymentForm: FormGroup;
  paymentSuccess: boolean = false;
  paymentError: string = '';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.paymentForm = this.fb.group({
      userId: ['', Validators.required],
      amount: [100, Validators.required],
      method: ['card', Validators.required]
    });
  }

  submitPayment() {
    this.paymentError = '';
    this.http.post(`${environment.apiBaseUrl}/payment/create`, this.paymentForm.value)
      .subscribe({
        next: (res: any) => {
          if (res.success) {
            this.paymentSuccess = true;
          } else {
            this.paymentError = res.message || 'Payment failed.';
          }
        },
        error: err => {
          this.paymentError = 'Payment failed.';
        }
      });
  }
}
