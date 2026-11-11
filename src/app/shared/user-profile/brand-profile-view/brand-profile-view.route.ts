import { Route, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { BrandProfileViewComponent } from './brand-profile-view.component';
import { ConfigService } from '../../config.service';
import { firstValueFrom } from 'rxjs';

export default [
  {
    path: '',
    component: BrandProfileViewComponent,
    resolve: {
      // { brand, status, message } — the page explains a 401 (log in) or 403 (daily limit)
      // instead of showing "Brand not found" for a brand that exists.
      brandResult: async (route: ActivatedRouteSnapshot) => {
        const config = inject(ConfigService);
        const brandName = route.paramMap.get('brandName') || route.parent?.paramMap.get('brandName');
        if (!brandName) return null;
        return firstValueFrom(config.getBrandProfileResult(brandName));
      }
    }
  }
] as Route[];
