import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { appConfig as baseAppConfig } from './app.config';
import { provideServerRendering } from '@angular/platform-server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering()
  ]
};

export const appConfig = mergeApplicationConfig(baseAppConfig, serverConfig);
