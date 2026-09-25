import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { PushNotificationService } from './core/push-notification.service';
import { SwUpdate } from '@angular/service-worker';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: NEVER, activateUpdate: async () => false } },
        {
          provide: PushNotificationService,
          useValue: {
            requestSubscription: async () => false,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // No <h1> in the template, so skip the title render test
});
