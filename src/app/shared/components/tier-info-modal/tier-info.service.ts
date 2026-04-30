import { Injectable } from '@angular/core';
import { TIER_DEFAULTS } from '../../tiers.constants';

@Injectable({ providedIn: 'root' })
export class TierInfoService {
  readonly tiers = TIER_DEFAULTS;
  isOpen = false;

  open(): void  { this.isOpen = true;  }
  close(): void { this.isOpen = false; }
}
