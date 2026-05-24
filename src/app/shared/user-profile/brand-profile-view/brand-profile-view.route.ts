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
      brand: async (route: ActivatedRouteSnapshot) => {
        const config = inject(ConfigService);
        const brandName = route.paramMap.get('brandName') || route.parent?.paramMap.get('brandName');
        if (!brandName) return null;
        return firstValueFrom(config.getBrandByName(brandName));
      }
    }
  }
] as Route[];
