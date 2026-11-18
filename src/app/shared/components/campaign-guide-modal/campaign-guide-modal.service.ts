import { Injectable } from '@angular/core';

export interface CampaignGuideSection {
  heading: string;
  /** Body text. Supports plain text with newlines/bullets. */
  body: string;
  /** When true, shows a Copy button beside this section. Default true. */
  copyable?: boolean;
  /** Optional intent for styling (info, warn, tip). */
  variant?: 'info' | 'tip' | 'warn';
}

export interface CampaignGuideContent {
  title: string;
  subtitle?: string;
  sections: CampaignGuideSection[];
  /** Optional concatenated copy-all payload override. */
  copyAllText?: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignGuideModalService {
  isOpen = false;
  content: CampaignGuideContent | null = null;

  open(content: CampaignGuideContent): void {
    this.content = content;
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
    this.content = null;
  }
}
