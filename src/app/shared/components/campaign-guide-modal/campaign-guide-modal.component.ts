import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampaignGuideModalService, CampaignGuideSection } from './campaign-guide-modal.service';
import { ToastService } from '../../toast/toast.service';

@Component({
  selector: 'app-campaign-guide-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-guide-modal.component.html',
  styleUrls: ['./campaign-guide-modal.component.scss'],
})
export class CampaignGuideModalComponent {
  protected readonly guide = inject(CampaignGuideModalService);
  private readonly toast = inject(ToastService);

  isCopyable(section: CampaignGuideSection): boolean {
    return section.copyable !== false;
  }

  async copySection(section: CampaignGuideSection): Promise<void> {
    await this.copyText(section.body);
  }

  async copyAll(): Promise<void> {
    const c = this.guide.content;
    if (!c) return;
    const text = c.copyAllText ?? c.sections
      .filter((s) => this.isCopyable(s))
      .map((s) => `${s.heading}\n${s.body}`)
      .join('\n\n');
    await this.copyText(text);
  }

  private async copyText(text: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      this.toast.show('Copied to clipboard', 'success');
    } catch {
      this.toast.show('Copy failed — please select and copy manually', 'error');
    }
  }
}
