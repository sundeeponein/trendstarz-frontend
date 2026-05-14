import { Injectable, signal } from '@angular/core';

export type GuidelineType = 'influencer' | 'brand';

@Injectable({ providedIn: 'root' })
export class ImageGuidelinesService {
  isOpen = signal(false);
  currentType = signal<GuidelineType>('influencer');

  open(type: GuidelineType = 'influencer'): void {
    this.currentType.set(type);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(type: GuidelineType = 'influencer'): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(type);
    }
  }
}
