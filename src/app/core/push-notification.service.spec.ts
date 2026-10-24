import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SwPush } from '@angular/service-worker';
import { NEVER, Subject } from 'rxjs';
import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let http: HttpTestingController;
  let swPush: any;
  const subscription$ = new Subject<any>();

  beforeEach(() => {
    swPush = {
      isEnabled: true,
      subscription: subscription$.asObservable(), // like the real one: never completes
      messages: NEVER,
      requestSubscription: jasmine.createSpy('requestSubscription').and.resolveTo({
        toJSON: () => ({ endpoint: 'https://push/x', keys: { p256dh: 'p', auth: 'a' } }),
      }),
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PushNotificationService, { provide: SwPush, useValue: swPush }],
    });
    service = TestBed.inject(PushNotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  it('reads the VAPID key from the wrapped API response and subscribes', async () => {
    const done = service.requestSubscription('influencer');
    await Promise.resolve();
    http.expectOne((r) => r.url.endsWith('/push/vapid-public-key')).flush({ success: true, data: { key: 'BBkey' } });
    await new Promise((r) => setTimeout(r));
    http.expectOne((r) => r.url.endsWith('/push/subscribe')).flush({ success: true });
    expect(await done).toBeTrue();
    expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'BBkey' });
  });

  it('checking for a subscription finishes even though the browser stream never completes', async () => {
    const check = service.hasActiveSubscription();
    subscription$.next({ endpoint: 'https://push/x' });
    expect(await check).toBeTrue();
  });
});
