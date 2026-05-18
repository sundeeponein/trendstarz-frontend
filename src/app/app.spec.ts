import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { PushNotificationService } from './core/push-notification.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
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
