import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-premium-upgrade',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './premium-upgrade.component.html',
  styleUrls: ['./premium-upgrade.component.scss'],
})
export class PremiumUpgradeComponent {
  selectedDuration: '1m' | '3m' | '1y' | '' = '';
  upgrading = false;
  upgradeSuccess = false;
  upgradeError = '';

  plans = [
    { duration: '1m' as const, label: '1 Month', price: '₹399', badge: '', pricePer: '₹399/mo' },
    { duration: '3m' as const, label: '3 Months', price: '₹999', badge: 'Save 16%', pricePer: '₹333/mo' },
    { duration: '1y' as const, label: '1 Year', price: '₹2,999', badge: 'Best Value', pricePer: '₹250/mo' },
  ];

  constructor(private http: HttpClient, private router: Router) {}

  selectPlan(duration: '1m' | '3m' | '1y') {
    this.selectedDuration = duration;
    this.upgradeError = '';
  }

  proceed() {
    if (!this.selectedDuration) {
      this.upgradeError = 'Please select a plan to continue.';
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      this.upgradeError = 'You are not logged in. Please log in and try again.';
      return;
    }
    this.upgrading = true;
    this.upgradeError = '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http
      .patch(
        `${environment.apiBaseUrl}/users/me/premium`,
        { premiumDuration: this.selectedDuration },
        { headers },
      )
      .subscribe({
        next: () => {
          this.upgrading = false;
          this.upgradeSuccess = true;
        },
        error: (err) => {
          this.upgrading = false;
          this.upgradeError =
            err?.error?.message || 'Upgrade failed. Please try again.';
        },
      });
  }

  goToProfile() {
    const userStr = localStorage.getItem('user');
    let role = 'influencer';
    try {
      if (userStr) {
        const user = JSON.parse(userStr);
        role = user?.role || 'influencer';
      }
    } catch {
      role = 'influencer';
    }
    if (role === 'brand') {
      this.router.navigate(['/brand-profile']);
    } else {
      this.router.navigate(['/influencer-profile']);
    }
  }
}
