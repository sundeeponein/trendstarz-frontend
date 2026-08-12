import { Injectable } from '@angular/core';
import { MonetizationApiService } from './monetization-api.service';

type SocialTargetRole = 'brand' | 'influencer' | 'photographer';

export interface SocialClickTrackInput {
  targetUserId: string;
  targetRole: SocialTargetRole;
  platform: string;
  url: string;
  source: string;
}

@Injectable({ providedIn: 'root' })
export class SocialClickTrackerService {
  private readonly lastClickByKey = new Map<string, number>();
  private readonly cooldownMs = 1500;

  constructor(private readonly monetizationApi: MonetizationApiService) {}

  track(input: SocialClickTrackInput): void {
    const targetUserId = String(input.targetUserId || '').trim();
    const source = String(input.source || '').trim();
    const platform = String(input.platform || 'website').trim() || 'website';
    const url = String(input.url || '').trim();

    if (!targetUserId || !source || !url || url === '#') return;

    const key = `${source}|${targetUserId}|${platform}|${url}`;
    const now = Date.now();
    const last = this.lastClickByKey.get(key);
    if (typeof last === 'number' && now - last < this.cooldownMs) {
      return;
    }

    this.lastClickByKey.set(key, now);
    this.cleanup(now);

    this.monetizationApi.trackSocialClick({
      targetUserId,
      targetRole: input.targetRole,
      platform,
      url,
      source,
    }).subscribe({
      next: () => {},
      error: () => {},
    });
  }

  private cleanup(now: number): void {
    if (this.lastClickByKey.size <= 200) return;
    const expireBefore = now - this.cooldownMs * 10;
    for (const [key, timestamp] of this.lastClickByKey.entries()) {
      if (timestamp < expireBefore) {
        this.lastClickByKey.delete(key);
      }
    }
  }
}
