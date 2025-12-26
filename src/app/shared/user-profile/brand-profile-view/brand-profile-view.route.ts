import { Route } from '@angular/router';
import { inject } from '@angular/core';
import { BrandProfileViewComponent } from './brand-profile-view.component';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export default [
  {
    path: '',
    component: BrandProfileViewComponent,
    resolve: {
      brand: async (route: any) => {
        const http = inject(HttpClient);
        const id = route.paramMap.get('id');
        if (!id) return null;
        // Adjust API endpoint as needed
        return http.get(`${environment.apiBaseUrl}/users/brand/${id}`).toPromise();
      }
    }
  }
] as Route[];
