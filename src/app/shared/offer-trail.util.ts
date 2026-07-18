function numberAtPath(source: any, path: string): number {
  if (!source || typeof source !== 'object' || !path) return 0;
  const value = path.split('.').reduce<any>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return acc[key];
  }, source);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountFrom(source: any, paisePaths: string[], rupeePaths: string[]): number | null {
  for (const path of paisePaths) {
    const value = numberAtPath(source, path);
    if (value > 0) return value / 100;
  }
  for (const path of rupeePaths) {
    const value = numberAtPath(source, path);
    if (value > 0) return value;
  }
  return null;
}

function formatInr(value: number | null | undefined): string {
  const safe = Number(value ?? 0);
  if (!Number.isFinite(safe) || safe <= 0) return '₹0';
  return `₹${safe.toLocaleString('en-IN')}`;
}

function normalized(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function campaignContentTypePrice(source: any): number | null {
  const campaign = source?.campaign || source?.campaignId || source || {};
  const rows = Array.isArray(campaign?.socialMedia) ? campaign.socialMedia : [];
  if (!rows.length) return null;

  const lockedPlatform = normalized(source?.selectedPlatform || source?.counterOffer?.selectedPlatform || campaign?.selectedPlatform);
  const lockedContentType = normalized(source?.selectedContentType || source?.counterOffer?.selectedContentType || campaign?.selectedContentType);

  const prices: number[] = [];
  for (const row of rows) {
    const platform = normalized(row?.platform);
    if (lockedPlatform && platform && platform !== lockedPlatform) continue;
    const contentTypes = Array.isArray(row?.contentTypes) ? row.contentTypes : [];
    for (const ct of contentTypes) {
      const enabled = ct?.enabled !== false;
      if (!enabled) continue;
      const name = normalized(ct?.name);
      if (lockedContentType && name && name !== lockedContentType) continue;
      const price = Number(ct?.price || 0);
      if (Number.isFinite(price) && price > 0) prices.push(price);
    }
  }
  if (!prices.length) return null;
  return prices[0];
}

function parseOfferTrace(source: any): {
  status: string;
  counterStatus: string;
  original: number | null;
  counterSent: number | null;
  revised: number | null;
  final: number | null;
  hasCounterFlow: boolean;
} {
  const original = amountFrom(
    source,
    [
      'originalAmountPaise',
      'baseAmountPaise',
      'campaignAmountPaise',
      'pricePerInfluencer',
      'campaign.pricePerInfluencer',
      'campaignId.pricePerInfluencer',
    ],
    [
      'originalAmount',
      'baseAmount',
      'campaignAmount',
      'pricePerInfluencerRupees',
    ],
  );

  const socialMediaPrice = campaignContentTypePrice(source);
  const originalResolved = original || socialMediaPrice;

  const counterOffer = source?.counterOffer || {};
  const counterStatus = String(source?.counterOfferStatus || counterOffer?.status || '')
    .trim()
    .toLowerCase();

  const resolvedAcceptedCounter = counterStatus === 'accepted' && !counterOffer?.requestedAmount && counterOffer?.offeredAmount
    ? Number(counterOffer?.offeredAmount || 0)
    : 0;

  const counterSent = counterStatus === 'brand_sent'
    ? amountFrom(
        source,
        [
          'counterOfferedAmountPaise',
          'offeredAmountPaise',
          'counterOffer.offeredAmountPaise',
        ],
        [
          'counterOfferedAmount',
          'offeredAmount',
          'counterOffer.offeredAmount',
        ],
      )
    : amountFrom(
        source,
        [
          'counterRequestedAmountPaise',
          'requestedAmountPaise',
          'counterOffer.requestedAmountPaise',
        ],
        [
          'counterRequestedAmount',
          'requestedAmount',
          'counterOffer.requestedAmount',
        ],
      ) || amountFrom(
        source,
        [
          'counterOfferedAmountPaise',
          'offeredAmountPaise',
          'counterOffer.offeredAmountPaise',
        ],
        [
          'counterOfferedAmount',
          'offeredAmount',
          'counterOffer.offeredAmount',
        ],
      );

  const revised = counterStatus === 'brand_sent'
    ? amountFrom(
        source,
        [
          'counterRequestedAmountPaise',
          'requestedAmountPaise',
          'revisedAmountPaise',
          'counterOffer.requestedAmountPaise',
        ],
        [
          'counterRequestedAmount',
          'requestedAmount',
          'revisedAmount',
          'counterOffer.requestedAmount',
        ],
      )
    : counterStatus === 'accepted'
      ? amountFrom(
          source,
          [
            'counterRequestedAmountPaise',
            'requestedAmountPaise',
            'counterOffer.requestedAmountPaise',
            'agreedAmountPaise',
            'finalAmountPaise',
          ],
          [
            'counterRequestedAmount',
            'requestedAmount',
            'counterOffer.requestedAmount',
            'agreedAmount',
            'finalAmount',
          ],
        ) || resolvedAcceptedCounter
      : null;

  const final = amountFrom(
    source,
    ['agreedAmountPaise', 'finalAmountPaise'],
    ['agreedAmount', 'finalAmount'],
  );

  const resolvedFinal = final || revised || counterSent || originalResolved;

  const status = String(source?.status || '').trim().toLowerCase();
  const hasCounterFlow =
    counterStatus === 'sent'
    || counterStatus === 'brand_sent'
    || counterStatus === 'accepted'
    || !!counterSent
    || !!revised
    || !!resolvedFinal;

  return {
    status,
    counterStatus,
    original: originalResolved,
    counterSent,
    revised,
    final,
    hasCounterFlow,
  };
}

export function buildAdminOfferTrailText(source: any): string {
  if (!source) return '';
  const trace = parseOfferTrace(source);
  const finalValue = trace.final ?? trace.revised ?? trace.counterSent ?? trace.original ?? 0;
  if (!trace.original) {
    if (trace.counterStatus === 'accepted' && trace.counterSent && trace.revised && finalValue) {
      return `Negotiation: Receiver countered ${formatInr(trace.counterSent)} -> Host revised to ${formatInr(trace.revised)} -> Final agreed ${formatInr(finalValue)}`;
    }
    if (trace.counterSent && finalValue) {
      return `Negotiation: Countered ${formatInr(trace.counterSent)} -> Final agreed ${formatInr(finalValue)}`;
    }
    if (finalValue) {
      return `Final agreed amount ${formatInr(finalValue)}`;
    }
    return '';
  }

  if (!trace.hasCounterFlow) {
    const acceptedFinal = finalValue || trace.original;
    return `Negotiation: Host offered ${formatInr(trace.original)} -> Final agreed ${formatInr(acceptedFinal)}`;
  }

  if (trace.counterStatus === 'accepted') {
    if (trace.counterSent && finalValue) {
      return `Negotiation: Host offered ${formatInr(trace.original)} -> Receiver countered ${formatInr(trace.counterSent)} -> Host accepted ${formatInr(finalValue)}`;
    }
    if (trace.revised && trace.original) {
      return `Negotiation: Host offered ${formatInr(trace.original)} -> Receiver countered ${formatInr(trace.revised)} -> Host accepted ${formatInr(finalValue)}`;
    }
  }

  if (trace.counterStatus === 'brand_sent' && trace.counterSent && trace.revised) {
    return `Negotiation: Host offered ${formatInr(trace.original)} -> Receiver countered ${formatInr(trace.counterSent)} -> Host revised to ${formatInr(trace.revised)}`;
  }

  if (trace.counterStatus === 'sent' && trace.counterSent) {
    return `Negotiation: Host offered ${formatInr(trace.original)} -> Receiver countered ${formatInr(trace.counterSent)}`;
  }

  if (finalValue) {
    return `Negotiation: Host offered ${formatInr(trace.original)} -> Final agreed ${formatInr(finalValue)}`;
  }

  return `Negotiation: Host offered ${formatInr(trace.original)}`;
}

export function buildAdminOfferTotalText(source: any): string {
  if (!source) return '';
  const trace = parseOfferTrace(source);
  if (!trace.original) return '';
  const finalValue = trace.final ?? trace.revised ?? trace.counterSent ?? trace.original ?? 0;
  const delta = finalValue - trace.original;
  const deltaAbs = Math.abs(delta);
  const trend = delta > 0 ? `+${formatInr(deltaAbs)}` : delta < 0 ? `-${formatInr(deltaAbs)}` : formatInr(0);
  if (delta === 0) {
    return `No price change from the initial offer. Final agreed amount: ${formatInr(finalValue)}`;
  }
  return `Net change from initial offer: ${trend}. Final agreed amount: ${formatInr(finalValue)}`;
}

export function buildUserPriceTrailText(source: any): string {
  if (!source) return '';
  const trace = parseOfferTrace(source);
  if (!trace.original) {
    const fallbackFinal = trace.final ?? trace.revised ?? trace.counterSent ?? 0;
    return fallbackFinal ? `Final price to pay ${formatInr(fallbackFinal)}` : '';
  }
  const finalValue = trace.final ?? trace.revised ?? trace.counterSent ?? trace.original ?? 0;
  if (finalValue !== trace.original) {
    return `Initial price sent ${formatInr(trace.original)} -> Final price to pay ${formatInr(finalValue)}`;
  }
  return `Initial price sent ${formatInr(trace.original)}`;
}

export function buildOfferTrailText(source: any): string {
  return buildAdminOfferTrailText(source);
}