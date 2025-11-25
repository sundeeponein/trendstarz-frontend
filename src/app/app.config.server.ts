import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';
import { withAppShell } from '@angular/ssr';
import { AppShell } from './app-shell/app-shell';

const serverConfig: ApplicationConfig = {
  providers: [
  provideServerRendering()
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
