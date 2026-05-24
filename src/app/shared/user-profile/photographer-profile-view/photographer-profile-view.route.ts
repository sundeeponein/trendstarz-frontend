import { Route, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PhotographerProfileViewComponent } from './photographer-profile-view.component';
import { ConfigService } from '../../config.service';

export default [
  {
    path: '',
    component: PhotographerProfileViewComponent,
    resolve: {
      photographer: async (route: ActivatedRouteSnapshot) => {
        const config = inject(ConfigService);
        const username = route.paramMap.get('username') || route.parent?.paramMap.get('username');
        if (!username) return null;
        return firstValueFrom(config.getPhotographerByUsername(username));
      },
    },
  },
] as Route[];
