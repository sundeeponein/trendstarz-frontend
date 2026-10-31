import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlansService } from '../../shared/plans.service';

/**
 * "Stop offer emails" link from Premium offer emails. Needs one click (not on
 * page load) so email link-scanners that open every link don't opt people out.
 */
@Component({
  selector: 'app-offer-email-unsubscribe',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="unsub">
      <div class="unsub-card">
        <h1>Offer emails</h1>
        <ng-container [ngSwitch]="state">
          <ng-container *ngSwitchCase="'ask'">
            <p>Stop receiving Premium offer emails from Trendstarz? You'll still get emails about your account, invites and payments.</p>
            <button type="button" class="unsub-btn" [disabled]="busy" (click)="confirm()">{{ busy ? 'Saving…' : 'Stop offer emails' }}</button>
          </ng-container>
          <p *ngSwitchCase="'done'">Done. You won't receive Premium offer emails any more.</p>
          <p *ngSwitchCase="'invalid'">This link is not valid. Please use the link from the latest email.</p>
        </ng-container>
        <a routerLink="/" class="unsub-home">Go to Trendstarz</a>
      </div>
    </main>
  `,
  styles: [`
    .unsub { min-height: 60vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
    .unsub-card { max-width: 440px; width: 100%; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; }
    .unsub-card h1 { font-size: 1.3rem; margin: 0 0 12px; color: #1f2937; }
    .unsub-card p { color: #4b5563; line-height: 1.5; margin: 0 0 16px; }
    .unsub-btn { background: #0d6efd; color: #fff; border: 0; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; }
    .unsub-btn:disabled { opacity: 0.6; cursor: default; }
    .unsub-home { display: inline-block; margin-top: 16px; color: #6b7280; font-size: 0.9rem; }
  `],
})
export class OfferEmailUnsubscribeComponent {
  state: 'ask' | 'done' | 'invalid' = 'ask';
  busy = false;
  private readonly token: string;

  constructor(
    route: ActivatedRoute,
    private plansService: PlansService,
    private cdr: ChangeDetectorRef,
  ) {
    this.token = route.snapshot.queryParamMap.get('t') || '';
    if (!this.token) this.state = 'invalid';
  }

  confirm(): void {
    this.busy = true;
    this.plansService.unsubscribeOfferEmails(this.token).subscribe({
      next: () => {
        this.state = 'done';
        this.busy = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.state = 'invalid';
        this.busy = false;
        this.cdr.detectChanges();
      },
    });
  }
}
