import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConfigService } from './config.service';
import { buildSocialProfileUrl } from './social-handle.util';

/**
 * "Hosts can't open your Instagram link" — the creator's own links that hosts
 * reported (2026-11-16). Shown on the dashboard and profile until the creator
 * updates the handle (that clears the report) or an admin finds it works.
 */
@Component({
  selector: 'app-reported-links-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="rlb" *ngIf="accounts.length">
      <div class="rlb-title"><i class="bi bi-link-45deg"></i> Hosts can't open {{ accounts.length === 1 ? 'one of your links' : 'some of your links' }}</div>
      <ul class="rlb-list">
        <li *ngFor="let a of accounts">
          <strong>{{ a.platform }}</strong>
          <a *ngIf="url(a) as href" [href]="href" target="_blank" rel="noopener noreferrer">&#64;{{ a.handle }}</a>
          <span *ngIf="!url(a)">&#64;{{ a.handle }}</span>
          <small>
            · {{ a.status === 'confirmed' ? 'checked by TrendStarZ: it does not open' : 'reported by hosts' }}<ng-container *ngIf="a.since"> on {{ a.since | date: 'd MMM' }}</ng-container>
          </small>
        </li>
      </ul>
      <p class="rlb-sub">
        Open the link to check it. If you changed your username, update it on your profile so hosts can see your account.
      </p>
      <a *ngIf="showEdit" class="btn btn-sm btn-warning" [routerLink]="editLink">Update my accounts</a>
    </div>
  `,
  styles: [
    `
      .rlb { margin-bottom: 16px; padding: 12px 14px; border-radius: 12px; border: 1px solid #fcd34d; background: #fffbeb; color: #1e293b; }
      .rlb-title { font-weight: 700; color: #92400e; }
      .rlb-list { margin: 6px 0; padding-left: 18px; font-size: 13px; }
      .rlb-list a { margin-left: 6px; }
      .rlb-list small { color: #a16207; }
      .rlb-sub { margin: 0 0 8px; font-size: 13px; color: #475569; }
      :host-context([data-theme='dark']) .rlb { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.35); color: #e2e8f0; }
      :host-context([data-theme='dark']) .rlb-sub { color: #cbd5e1; }
    `,
  ],
})
export class ReportedLinksBannerComponent implements OnInit {
  @Input() editLink = '/influencer-profile';
  /** False on the profile page itself (the creator is already there). */
  @Input() showEdit = true;
  accounts: Array<{ platform: string; handle: string; platformAccountId?: string | null; status: string; since: string | null }> = [];

  constructor(private config: ConfigService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.config.getMyReportedLinks().subscribe({
      next: (res) => {
        this.accounts = res?.accounts || [];
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  url(a: any): string {
    return buildSocialProfileUrl(a?.platform || '', a?.handle, a?.platformAccountId);
  }
}
