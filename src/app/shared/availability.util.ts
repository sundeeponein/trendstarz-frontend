/**
 * Option B (3D-1d): "not available" is time-limited. Mirrors the backend
 * (utils/collaboration-availability.util.ts): a period without an end date
 * (set before durations existed) ends 14 days after it was chosen.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_NOT_AVAILABLE_DAYS = 14;

export const NOT_AVAILABLE_DURATIONS: Array<{ days: number; label: string }> = [
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
];

function validDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** When a creator's "not available" period ends, or null when they aren't marked not available (or it has ended). */
export function notAvailableUntil(availability: any, now: Date = new Date()): Date | null {
  if (availability?.state !== 'not_available') return null;
  const until =
    validDate(availability?.notAvailableUntil) ||
    (validDate(availability?.stateUpdatedAt)
      ? new Date(validDate(availability.stateUpdatedAt)!.getTime() + DEFAULT_NOT_AVAILABLE_DAYS * DAY_MS)
      : null);
  return until && until.getTime() > now.getTime() ? until : null;
}

/** "May be busy until 23 Oct" for a host looking at a creator, or '' when they're not marked not available. */
export function busyUntilText(creator: any, now: Date = new Date()): string {
  const until = notAvailableUntil(creator?.collaborationAvailability, now);
  if (!until) return '';
  const date = until.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `May be busy until ${date}`;
}
