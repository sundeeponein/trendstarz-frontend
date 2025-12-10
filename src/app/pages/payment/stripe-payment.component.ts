import { Component, OnInit } from '@angular/core';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-stripe-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stripe-payment.component.html',
  styleUrls: ['./stripe-payment.component.scss']
})
export class StripePaymentComponent implements OnInit {
  premiumDuration: '1m' | '3m' | '1y' | '' = '';
  premiumAmount = 0;
  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  card: StripeCardElement | null = null;
  clientSecret: string = '';
  paymentSuccess = false;
  paymentError = '';

  async ngOnInit() {
    // Default: no plan selected
    this.premiumDuration = '';
    this.premiumAmount = 0;
    this.stripe = await loadStripe(environment.stripePublicKey);
  }

  constructor(private http: HttpClient) {}

  createPaymentIntent(amount: number) {
    this.http.post<any>(`${environment.apiBaseUrl}/payment/create-intent`, { amount })
      .subscribe(res => {
        this.clientSecret = res.clientSecret;
      });
  }

  selectPlan(duration: '1m' | '3m' | '1y') {
    this.premiumDuration = duration;
    if (duration === '1m') this.premiumAmount = 399;
    if (duration === '3m') this.premiumAmount = 999;
    if (duration === '1y') this.premiumAmount = 1999;
    this.createPaymentIntent(this.premiumAmount);
  }

  async pay() {
    if (!this.stripe || !this.card || !this.clientSecret || !this.premiumDuration) return;
    const { paymentIntent, error } = await this.stripe.confirmCardPayment(this.clientSecret, {
      payment_method: {
        card: this.card,
      },
    });
    if (error) {
      this.paymentError = error.message || 'Payment failed.';
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Call backend to upgrade user to premium with duration
      this.http.patch(`${environment.apiBaseUrl}/users/me/premium`, { isPremium: true, premiumDuration: this.premiumDuration }).subscribe({
        next: () => {
          this.paymentSuccess = true;
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        },
        error: () => {
          this.paymentError = 'Payment succeeded, but failed to upgrade user.';
        }
      });
    }
  }
}
