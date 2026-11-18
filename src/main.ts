import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { reportCspViolations } from './app/core/client-error-handler';

// Before the app starts, so early loads are reported too (see vercel.json policy).
reportCspViolations();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
