import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const STEPS = [
  { key: 'working',         label: 'Working' },
  { key: 'submitted',       label: 'Submitted' },
  { key: 'under_review',    label: 'Under Review' },
  { key: 'completed',       label: 'Completed' },
  { key: 'payout_released', label: 'Payout Released' },
];

@Component({
  selector: 'app-campaign-status-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="csb-wrapper">
      <ng-container *ngFor="let step of steps; let i = index">
        <div class="csb-step"
          [class.active]="step.key === currentStepKey"
          [class.done]="isDone(i)">
          <div class="csb-dot">
            <i class="bi bi-check-lg" *ngIf="isDone(i) && step.key !== currentStepKey"></i>
            <span *ngIf="!isDone(i) || step.key === currentStepKey">{{ i + 1 }}</span>
          </div>
          <div class="csb-label">{{ step.label }}</div>
        </div>
        <div class="csb-line" *ngIf="i < steps.length - 1" [class.done]="isDone(i)"></div>
      </ng-container>
    </div>
  `,
  styles: [`
    .csb-wrapper {
      display: flex;
      align-items: center;
      width: 100%;
      overflow-x: auto;
      padding: 8px 0 12px;
    }
    .csb-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 70px;
      gap: 6px;
    }
    .csb-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #2d2d2d;
      border: 2px solid #444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: #888;
      transition: all 0.2s ease;
    }
    .csb-step.done .csb-dot {
      background: #2a7a4e;
      border-color: #22b37a;
      color: #22b37a;
    }
    .csb-step.active .csb-dot {
      background: #E8580C;
      border-color: #E8580C;
      color: #fff;
      box-shadow: 0 0 0 3px rgba(232,88,12,0.25);
    }
    .csb-label {
      font-size: 10px;
      color: #777;
      text-align: center;
      white-space: nowrap;
    }
    .csb-step.done .csb-label,
    .csb-step.active .csb-label {
      color: #fff;
    }
    .csb-step.active .csb-label {
      color: #E8580C;
      font-weight: 600;
    }
    .csb-line {
      flex: 1;
      height: 2px;
      background: #333;
      margin-bottom: 22px;
      min-width: 20px;
      transition: background 0.2s;
    }
    .csb-line.done {
      background: #22b37a;
    }
  `]
})
export class CampaignStatusBarComponent {
  @Input() status: string = 'pending';

  steps = STEPS;

  get currentStepKey(): string {
    const normalized = String(this.status || '').toLowerCase().trim();
    const stageMap: Record<string, string> = {
      pending: 'working',
      accepted: 'working',
      payment_confirmed: 'working',
      working: 'working',
      submitted: 'under_review',
      disputed: 'under_review',
      completed: 'completed',
      approved: 'payout_released',
    };
    return stageMap[normalized] || 'working';
  }

  isDone(index: number): boolean {
    const currentIndex = STEPS.findIndex(s => s.key === this.currentStepKey);
    if (currentIndex < 0) return index === 0;
    return index <= currentIndex;
  }
}
