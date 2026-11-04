/** A creator's own checked YouTube count (GET creator/social-observations/mine). */
export interface YoutubeCheck {
  socialAccountId: string;
  platform: 'YouTube';
  /** null for "not found" (no count to show). */
  subscribers: number | null;
  capturedAt: string | null;
  /** The tier those subscribers fall in. */
  tier: string | null;
  /** The tier on the creator's profile right now. */
  declaredTier: string | null;
  /**
   * matches — profile tier is the observed one; please_update — same channel,
   * different tier; check_handle — the channel found has a different handle.
   */
  status: 'matches' | 'please_update' | 'check_handle' | 'handle_renamed' | 'not_found';
  /** The handle on the creator's profile. */
  handle?: string;
  /** handle_renamed: the channel's new handle on YouTube. */
  newHandle?: string | null;
  /** Set when TrendStarZ moved the declared tier to this one automatically. */
  tierAutoUpdatedAt: string | null;
}

/** The check for a YouTube platform entry (one YouTube account per profile), else null. */
export function youtubeCheckFor(platform: any, checks: YoutubeCheck[]): YoutubeCheck | null {
  const name = String(platform?.name || platform?.platform || platform?.platformKey || '').toLowerCase();
  return name.includes('youtube') ? checks[0] ?? null : null;
}
