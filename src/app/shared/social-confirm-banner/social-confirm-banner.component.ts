import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConfigService } from '../config.service';
import { buildSocialProfileUrl } from '../social-handle.util';

/**
 * Every 90 days: "Are these still your accounts?" One click confirms; Edit opens the
 * profile. Ignored for 14 days → TrendStarZ re-reviews the accounts.
 */
@Component({
  selector: 'app-social-confirm-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="scb" *ngIf="due && !done">
      <div class="scb-title"><i class="bi bi-person-check"></i> Are these still your accounts?</div>
      <p class="scb-sub">If you changed a username, hosts can't open your profile. Please check every 90 days.</p>
      <ul class="scb-list">
        <li *ngFor="let a of accounts">
          <strong>{{ a.platform }}</strong>
          <a *ngIf="url(a) as href" [href]="href" target="_blank" rel="noopener noreferrer">&#64;{{ a.handle }}</a>
          <span *ngIf="!url(a)">&#64;{{ a.handle }}</span>
        </li>
      </ul>
      <div class="scb-actions">
        <button type="button" class="btn btn-sm btn-primary" [disabled]="busy" (click)="confirm()">Yes, all correct</button>
        <a class="btn btn-sm btn-outline-secondary" [routerLink]="editLink">Edit my accounts</a>
      </div>
    </div>
  `,
  styles: [
    `
      .scb { margin-bottom: 16px; padding: 12px 14px; border-radius: 12px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1e293b; }
      .scb-title { font-weight: 700; }
      .scb-sub { margin: 2px 0 6px; font-size: 13px; color: #475569; }
      .scb-list { margin: 0 0 8px; padding-left: 18px; font-size: 13px; }
      .scb-list a { margin-left: 6px; }
      .scb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      :host-context([data-theme='dark']) .scb { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); color: #e2e8f0; }
      :host-context([data-theme='dark']) .scb-sub { color: #cbd5e1; }
    `,
  ],
})
export class SocialConfirmBannerComponent implements OnInit {
  @Input() editLink = '/influencer-profile';
  due = false;
  done = false;
  busy = false;
  accounts: Array<{ platform: string; handle: string; platformAccountId?: string | null }> = [];

  constructor(private config: ConfigService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.config.getSocialConfirmStatus().subscribe({
      next: (res) => {
        this.due = !!res?.due;
        this.accounts = res?.accounts || [];
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  url(a: any): string {
    return buildSocialProfileUrl(a?.platform || '', a?.handle, a?.platformAccountId);
  }

  confirm(): void {
    if (this.busy) return;
    this.busy = true;
    this.config.confirmSocialAccounts().subscribe({
      next: () => {
        this.busy = false;
        this.done = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.busy = false;
        this.cdr.markForCheck();
      },
    });
  }
}
