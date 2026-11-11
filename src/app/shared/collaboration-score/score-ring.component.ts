import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CollaborationScoreUiUtilsService } from '../../services/collaboration-score-ui-utils.service';

/**
 * Circular progress ring for a 0-100 Collaboration Score — CSS
 * conic-gradient rather than an SVG stroke-dasharray ring (same visual
 * result, no path-length math). Shared by the creator's own Score Center
 * card and the admin detail page so both render the identical ring.
 */
@Component({
  selector: 'app-score-ring',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score-ring.component.html',
  styleUrls: ['./score-ring.component.scss'],
})
export class ScoreRingComponent {
  @Input() score = 0;
  @Input() sizePx = 96;

  constructor(private readonly ui: CollaborationScoreUiUtilsService) {}

  get ringColor(): string {
    return this.ui.scoreRingColor(this.score);
  }

  get ringStyle(): Record<string, string> {
    const pct = Math.max(0, Math.min(100, this.score));
    const color = this.ringColor;
    return {
      width: `${this.sizePx}px`,
      height: `${this.sizePx}px`,
      background: `conic-gradient(${color} ${pct}%, #eceef2 ${pct}% 100%)`,
    };
  }
}
