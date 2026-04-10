import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-alert-banner',
  templateUrl: './dashboard-alert-banner.component.html',
  styleUrls: ['./dashboard-alert-banner.component.css'],
  standalone: true,
  imports: [CommonModule, DatePipe]
})
export class DashboardAlertBannerComponent {
  @Input() isEmailVerified = true;
  @Input() isPremium = false;
  @Input() premiumDuration: string | null = null;
  @Input() premiumStart: string | null = null;
  @Input() premiumEnd: string | null = null;
  @Input() profileIncomplete = false;
  @Input() userType: 'influencer' | 'brand' = 'influencer';
  @Input() userName: string = '';
  @Output() verifyEmail = new EventEmitter<void>();
  @Output() upgrade = new EventEmitter<void>();
  @Output() completeProfile = new EventEmitter<void>();
}
