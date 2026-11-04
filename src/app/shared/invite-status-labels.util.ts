/**
 * Who is looking at an invite's work status. Payment, work progress and payout
 * are separate fields — these labels describe work progress only.
 */
export type InviteStatusViewer = 'host' | 'admin' | 'creator';

/** `payment_confirmed`: the host's payment is verified; the creator hasn't pressed Start work yet. */
export function confirmedAwaitingStartLabel(viewer: InviteStatusViewer): string {
  if (viewer === 'admin') return 'Payment Confirmed — Awaiting Start';
  if (viewer === 'host') return 'Awaiting Work Start';
  return 'Ready to start';
}
