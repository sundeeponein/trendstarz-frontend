import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { ConfigService } from '../../shared/config.service';
import { captureSignupAttribution } from '../../shared/signup-attribution.util';

/**
 * "Get a creator shortlist" (growth plan move 2, 2026-11-16): a brand without
 * an account tells us city, niche and budget; TrendStarZ WhatsApps them 5
 * matching creators within 24 hours. The request lands on Admin → Growth.
 */
@Component({
  selector: 'app-creator-shortlist',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="cs container">
      <div class="cs-grid">
        <div class="cs-intro">
          <span class="cs-eyebrow">For brands and businesses</span>
          <h1>Get 5 creators for your campaign, free</h1>
          <p class="cs-lede">
            Tell us where you are, what you sell and your budget. Within 24 hours we'll WhatsApp you
            5 local creators who fit, with their rates. No account needed.
          </p>
          <ul class="cs-steps">
            <li><strong>1.</strong> Fill in this form (1 minute)</li>
            <li><strong>2.</strong> We pick 5 matching creators from your area</li>
            <li><strong>3.</strong> You choose who to work with. Pay only for creators who accept</li>
          </ul>
          <p class="cs-count" *ngIf="count !== null && form.category">
            <i class="bi bi-people-fill"></i>
            {{ count }} {{ form.category }} creators{{ form.state ? ' in ' + form.state : '' }} on TrendStarZ
          </p>
        </div>

        <div class="cs-card" *ngIf="!sent">
          <form (ngSubmit)="submit()" #f="ngForm" novalidate>
            <div class="row g-3">
              <div class="col-12 col-sm-6">
                <label class="form-label" for="cs-name">Your name</label>
                <input id="cs-name" name="name" class="form-control" [(ngModel)]="form.name" maxlength="80" autocomplete="name" required />
              </div>
              <div class="col-12 col-sm-6">
                <label class="form-label" for="cs-business">Business name</label>
                <input id="cs-business" name="businessName" class="form-control" [(ngModel)]="form.businessName" maxlength="100" autocomplete="organization" required />
              </div>
              <div class="col-12">
                <label class="form-label" for="cs-phone">WhatsApp number</label>
                <div class="input-group">
                  <span class="input-group-text">+91</span>
                  <input id="cs-phone" name="phone" class="form-control" [(ngModel)]="form.phone" inputmode="numeric" maxlength="14" autocomplete="tel-national" placeholder="98765 43210" required />
                </div>
              </div>
              <div class="col-12 col-sm-6">
                <label class="form-label" for="cs-state">State</label>
                <select id="cs-state" name="state" class="form-select" [(ngModel)]="form.state" (ngModelChange)="refreshCount()" required>
                  <option value="">Choose…</option>
                  <option *ngFor="let s of states" [value]="s">{{ s }}</option>
                </select>
              </div>
              <div class="col-12 col-sm-6">
                <label class="form-label" for="cs-city">City / district</label>
                <input id="cs-city" name="city" class="form-control" [(ngModel)]="form.city" maxlength="60" placeholder="e.g. Warangal" />
              </div>
              <div class="col-12 col-sm-6">
                <label class="form-label" for="cs-category">Niche</label>
                <select id="cs-category" name="category" class="form-select" [(ngModel)]="form.category" (ngModelChange)="refreshCount()" required>
                  <option value="">Choose…</option>
                  <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
                </select>
              </div>
              <div class="col-12 col-sm-6">
                <label class="form-label" for="cs-budget">Budget for this campaign</label>
                <select id="cs-budget" name="budget" class="form-select" [(ngModel)]="form.budget" required>
                  <option value="">Choose…</option>
                  <option *ngFor="let b of budgets" [value]="b.key">{{ b.label }}</option>
                </select>
              </div>
              <div class="col-12">
                <label class="form-label" for="cs-note">What do you want to promote? <span class="text-muted">(optional)</span></label>
                <textarea id="cs-note" name="note" class="form-control" rows="2" [(ngModel)]="form.note" maxlength="500" placeholder="e.g. new saree collection, opening offer at our restaurant"></textarea>
              </div>
              <!-- Left empty by people; bots fill it. -->
              <div class="cs-hp" aria-hidden="true">
                <label for="cs-website">Website</label>
                <input id="cs-website" name="website" tabindex="-1" autocomplete="off" [(ngModel)]="form.website" />
              </div>
            </div>
            <p class="cs-error" *ngIf="error" role="alert">{{ error }}</p>
            <button type="submit" class="btn cs-submit w-100 mt-3" [disabled]="sending">
              {{ sending ? 'Sending…' : 'Send me 5 creators' }}
            </button>
            <p class="cs-fine">We'll only use your number to send this shortlist. Already have an account? <a routerLink="/login">Log in</a> and invite creators yourself.</p>
          </form>
        </div>

        <div class="cs-card cs-done" *ngIf="sent" role="status">
          <i class="bi bi-check-circle-fill"></i>
          <h2>Thanks, {{ form.name }}!</h2>
          <p>We'll WhatsApp 5 matching creators to +91 {{ form.phone }} within 24 hours.</p>
          <p class="text-muted">Want to look around meanwhile? <a routerLink="/search">Browse creators</a> or <a routerLink="/register-brand">create a free brand account</a>.</p>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .cs { padding-block: 32px 56px; }
      .cs-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 32px; align-items: start; }
      @media (max-width: 860px) { .cs-grid { grid-template-columns: minmax(0, 1fr); } }
      .cs-eyebrow { font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; color: #c2410c; font-weight: 700; }
      .cs-intro h1 { font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 800; margin: 8px 0 12px; text-wrap: balance; }
      .cs-lede { color: #475569; font-size: 1.05rem; max-width: 52ch; }
      .cs-steps { list-style: none; padding: 0; margin: 18px 0; display: grid; gap: 8px; color: #1e293b; }
      .cs-count { display: inline-flex; gap: 8px; align-items: center; background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; border-radius: 999px; padding: 6px 14px; font-weight: 600; font-size: 0.92rem; }
      .cs-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); }
      .cs-submit { background: #c2410c; color: #fff; font-weight: 700; padding: 12px; }
      .cs-submit:hover:not(:disabled) { background: #9a3412; color: #fff; }
      .cs-error { color: #b91c1c; margin: 12px 0 0; font-size: 0.92rem; }
      .cs-fine { font-size: 0.82rem; color: #64748b; margin: 10px 0 0; }
      .cs-hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
      .cs-done { text-align: center; display: grid; gap: 8px; justify-items: center; }
      .cs-done .bi { font-size: 2.4rem; color: #15803d; }
      .cs-done h2 { font-size: 1.4rem; font-weight: 800; margin: 0; }
      :host-context([data-theme='dark']) .cs-card { background: #111827; border-color: #1f2937; }
      :host-context([data-theme='dark']) .cs-lede, :host-context([data-theme='dark']) .cs-steps { color: #cbd5e1; }
      :host-context([data-theme='dark']) .cs-count { background: rgba(194, 65, 12, 0.15); border-color: rgba(194, 65, 12, 0.4); color: #fdba74; }
    `,
  ],
})
export class CreatorShortlistComponent implements OnInit {
  readonly budgets = [
    { key: 'under_5k', label: 'Under ₹5,000' },
    { key: '5k_20k', label: '₹5,000 – ₹20,000' },
    { key: '20k_50k', label: '₹20,000 – ₹50,000' },
    { key: '50k_plus', label: '₹50,000+' },
    { key: 'barter', label: 'Free product / visit (no cash)' },
    { key: 'not_sure', label: 'Not sure yet' },
  ];
  states: string[] = [];
  categories: string[] = [];
  form = { name: '', businessName: '', phone: '', state: '', city: '', category: '', budget: '', note: '', website: '' };
  count: number | null = null;
  sending = false;
  sent = false;
  error = '';
  private countSeq = 0;

  constructor(
    private config: ConfigService,
    private cdr: ChangeDetectorRef,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Get a free creator shortlist | TrendStarZ');
    this.meta.updateTag({
      name: 'description',
      content: 'Tell us your city, niche and budget. TrendStarZ WhatsApps you 5 matching local creators within 24 hours. Free, no account needed.',
    });
    this.config.getStates().subscribe({
      next: (rows) => {
        this.states = (rows || []).map((r: any) => String(r?.name || r || '').trim()).filter(Boolean);
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
    this.config.getCategories('influencer').subscribe({
      next: (rows) => {
        this.categories = (rows || []).map((r: any) => String(r?.name || r || '').trim()).filter(Boolean);
        this.cdr.markForCheck();
      },
      error: () => undefined,
    });
  }

  refreshCount(): void {
    const seq = ++this.countSeq;
    if (!this.form.category) {
      this.count = null;
      return;
    }
    this.config.getShortlistCreatorCount(this.form.state, this.form.category).subscribe((n) => {
      if (seq !== this.countSeq) return;
      this.count = n;
      this.cdr.markForCheck();
    });
  }

  submit(): void {
    if (this.sending) return;
    this.error = this.check();
    if (this.error) return;
    this.sending = true;
    const a = captureSignupAttribution(new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), typeof window !== 'undefined' ? window : undefined);
    this.config
      .sendShortlistRequest({
        ...this.form,
        attribution: { source: a.source === 'direct' ? '' : a.source, medium: a.audience || '', campaign: a.campaign || '' },
      })
      .subscribe({
        next: () => {
          this.sending = false;
          this.sent = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.sending = false;
          this.error =
            err?.status === 429
              ? 'Too many tries. Please wait a minute and send again.'
              : err?.error?.message || 'We could not send this. Please check your connection and try again.';
          this.cdr.markForCheck();
        },
      });
  }

  /** Same rules as the server, so most mistakes show before sending. */
  private check(): string {
    const f = this.form;
    if (f.name.trim().length < 2) return 'Please add your name.';
    if (f.businessName.trim().length < 2) return 'Please add your business name.';
    const digits = f.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return "Please add a 10-digit Indian mobile number (we'll WhatsApp you on it).";
    if (!f.state) return 'Please choose your state.';
    if (!f.category) return 'Please choose the niche you want creators for.';
    if (!f.budget) return 'Please choose a budget.';
    return '';
  }
}
