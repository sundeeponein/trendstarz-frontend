import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampaignTransactionsPanelComponent } from './sections/campaign-transactions-panel.component';
import { PremiumPaymentsPanelComponent } from './sections/premium-payments-panel.component';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, PremiumPaymentsPanelComponent, CampaignTransactionsPanelComponent],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.scss'],
})
export class AdminPaymentsComponent {
  error = '';
  successMessage = '';

  viewMode: 'premium' | 'transactions' = 'premium';

  setViewMode(mode: 'premium' | 'transactions') {
    this.viewMode = mode;
  }

  onError(message: string) {
    this.error = message;
    this.successMessage = '';
  }

  onSuccess(message: string) {
    this.successMessage = message;
    this.error = '';
    setTimeout(() => {
      if (this.successMessage === message) this.successMessage = '';
    }, 3000);
  }
}
