import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

@Component({
  selector: 'app-verification-funnel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verification-funnel.component.html',
  styleUrls: ['./verification-funnel.component.scss'],
})
export class VerificationFunnelComponent {
  @Input() stages: FunnelStage[] = [];
  /** Smaller, denser rendering for the dashboard widget — full detail (drop-off %) only shows when false. */
  @Input() compact = false;

  get maxCount(): number {
    return Math.max(...this.stages.map((s) => s.count), 1);
  }

  barWidth(stage: FunnelStage): string {
    return `${Math.max(Math.round((stage.count / this.maxCount) * 100), 4)}%`;
  }

  dropOffPct(index: number): number | null {
    if (index === 0) return null;
    const prev = this.stages[index - 1]?.count || 0;
    if (prev <= 0) return null;
    const curr = this.stages[index]?.count || 0;
    return Math.round(((prev - curr) / prev) * 100);
  }
}
