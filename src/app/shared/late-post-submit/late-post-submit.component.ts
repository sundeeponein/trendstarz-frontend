import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../config.service';

export interface LatePostWindow {
  canSubmit: boolean;
  until: string | null;
  status: 'pending' | 'approved' | 'rejected' | null;
  url: string | null;
  reviewNote: string | null;
}

/**
 * Creator missed the deadline: while the host's refund is on hold (7 days) they can submit
 * the post link. TrendStarZ verifies it before anything happens with the money.
 */
@Component({
  selector: 'app-late-post-submit',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './late-post-submit.component.html',
  styleUrls: ['./late-post-submit.component.scss'],
})
export class LatePostSubmitComponent {
  @Input({ required: true }) inviteId = '';
  @Input({ required: true }) window!: LatePostWindow;

  url = '';
  note = '';
  busy = false;
  error = '';

  constructor(
    private config: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  get validUrl(): boolean {
    return /^https?:\/\/\S+$/i.test(this.url.trim());
  }

  submit() {
    if (!this.validUrl || this.busy) return;
    this.busy = true;
    this.error = '';
    this.config.submitLatePost(this.inviteId, this.url.trim(), this.note.trim() || undefined).subscribe({
      next: () => {
        this.busy = false;
        this.window = { ...this.window, canSubmit: false, status: 'pending', url: this.url.trim(), reviewNote: null };
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.busy = false;
        this.error = err?.error?.message || 'Could not submit. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }
}
