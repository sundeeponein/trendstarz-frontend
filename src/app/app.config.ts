import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { JwtInterceptor } from './core/jwt.interceptor';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
  provideBrowserGlobalErrorListeners(),
  provideRouter(routes, withPreloading(PreloadAllModules)),
  provideHttpClient(withInterceptorsFromDi()),
  provideClientHydration(withEventReplay()),
  { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true }
  ]
};
