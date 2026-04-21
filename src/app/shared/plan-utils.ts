// Utility for campaign plan/limit checks
export interface PlanCapabilities {
  limits: { key: string; value: number }[];
}

export function getMaxActiveCampaigns(caps: PlanCapabilities): number {
  return (
    caps.limits.find((l) => l.key === 'maxActiveCampaigns')?.value ?? 1
  );
}
