import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../config.service';

type Option = { key: string; label: string; needsLink?: boolean };

const OPTIONS: Record<'creator' | 'host', Option[]> = {
  creator: [
    { key: 'posted_not_submitted', label: 'I posted but forgot to submit the link' },
    { key: 'forgot', label: 'I missed the deadline' },
    { key: 'host_asked_not_to_post', label: 'The host asked me not to post' },
    { key: 'host_offered_outside', label: 'The host offered to deal outside TrendStarZ' },
    { key: 'other', label: 'Something else' },
  ],
  host: [
    { key: 'saw_post', label: 'I saw a post from the creator', needsLink: true },
    { key: 'no_post', label: 'I did not see any post' },
    { key: 'asked_creator_to_stop', label: 'I asked the creator to stop' },
    { key: 'other', label: 'Something else' },
  ],
};

/**
 * Private "what happened?" after a paid creator was closed without a post. Each side
 * answers once; the other side never sees it. TrendStarZ uses it as evidence.
 */
@Component({
  selector: 'app-closure-question',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cq" *ngIf="!done; else thanks">
      <div class="cq-title">
        <i class="bi bi-chat-square-text"></i>
        What happened? <span class="cq-private">Private — only TrendStarZ sees your answer.</span>
      </div>
      <label class="cq-option" *ngFor="let o of options">
        <input type="radio" [name]="'cq-' + inviteId" [value]="o.key" [(ngModel)]="answer" />
        <span>{{ o.label }}</span>
      </label>
      <input
        *ngIf="needsLink"
        class="form-control form-control-sm mt-1"
        type="url"
        [(ngModel)]="link"
        placeholder="https://… link of the post" />
      <textarea
        *ngIf="answer"
        class="form-control form-control-sm mt-1"
        rows="2"
        maxlength="1000"
        [(ngModel)]="details"
        placeholder="Details (optional)"></textarea>
      <div class="cq-actions">
        <button type="button" class="btn btn-sm btn-primary" [disabled]="!valid || busy" (click)="send()">
          {{ busy ? 'Sending…' : 'Send to TrendStarZ' }}
        </button>
      </div>
      <div class="cq-error" *ngIf="error">{{ error }}</div>
    </div>
    <ng-template #thanks>
      <div class="cq cq--done"><i class="bi bi-check2-circle"></i> Thanks — TrendStarZ will review it.</div>
    </ng-template>
  `,
  styles: [
    `
      .cq {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--ts-border, #e2e8f0);
        background: #f8fafc;
        color: #1e293b;
        font-size: 13px;
      }
      .cq--done {
        color: #15803d;
      }
      .cq-title {
        font-weight: 600;
        margin-bottom: 4px;
      }
      .cq-private {
        font-weight: 400;
        color: #64748b;
        font-size: 12px;
      }
      .cq-option {
        display: flex;
        gap: 6px;
        align-items: flex-start;
        margin: 2px 0;
        cursor: pointer;
      }
      .cq-option input {
        margin-top: 3px;
      }
      .cq-actions {
        margin-top: 6px;
      }
      .cq-error {
        margin-top: 4px;
        color: #b91c1c;
      }
      :host-context([data-theme='dark']) .cq {
        background: rgba(148, 163, 184, 0.08);
        border-color: rgba(148, 163, 184, 0.25);
        color: #e2e8f0;
      }
      :host-context([data-theme='dark']) .cq-private {
        color: #94a3b8;
      }
    `,
  ],
})
export class ClosureQuestionComponent {
  @Input({ required: true }) inviteId = '';
  @Input() role: 'creator' | 'host' = 'creator';

  answer = '';
  details = '';
  link = '';
  busy = false;
  done = false;
  error = '';

  constructor(
    private config: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  get options(): Option[] {
    return OPTIONS[this.role];
  }

  get needsLink(): boolean {
    return !!this.options.find((o) => o.key === this.answer)?.needsLink;
  }

  get valid(): boolean {
    if (!this.answer) return false;
    return !this.needsLink || /^https?:\/\/\S+$/i.test(this.link.trim());
  }

  send() {
    if (!this.valid || this.busy) return;
    this.busy = true;
    this.error = '';
    this.config
      .submitClosureAnswer(this.inviteId, {
        answer: this.answer,
        details: this.details.trim() || undefined,
        link: this.link.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.done = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.busy = false;
          this.error = err?.error?.message || 'Could not send. Please try again.';
          this.cdr.markForCheck();
        },
      });
  }
}
