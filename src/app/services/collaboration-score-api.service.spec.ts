import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CollaborationScoreApiService } from './collaboration-score-api.service';

// The backend wraps every response in { success, data } via a global Nest
// interceptor unless the payload already has a `success` key (see
// response.interceptor.ts). These tests exercise a real HTTP round-trip
// through HttpClient so a regression here — reading a field one level too
// shallow — actually fails, unlike a spy-based test that returns the
// unwrapped shape directly and would never catch this class of bug.
describe('CollaborationScoreApiService', () => {
  let service: CollaborationScoreApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CollaborationScoreApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('unwraps previewFromYoutubeUrl from the {success, data} envelope', () => {
    let result: any;
    service.previewFromYoutubeUrl('https://youtube.com/@creator').subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/preview'));
    req.flush({
      success: true,
      data: { platform: 'YouTube', handle: '@creator', previewScore: 49, confidence: 95, confidenceReason: 'ok' },
    });

    expect(result.previewScore).toBe(49);
    expect(result.handle).toBe('@creator');
  });

  it('unwraps getAudit from the envelope', () => {
    let result: any;
    service.getAudit('u1').subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/u1'));
    req.flush({ success: true, data: { userId: 'u1', collaborationScore: 72 } });

    expect(result.collaborationScore).toBe(72);
  });

  it('unwraps getConnections from the envelope', () => {
    let result: any;
    service.getConnections().subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/connections'));
    req.flush({
      success: true,
      data: { instagram: { handle: 'creator', followersCount: 1000, connectedAt: '2026-01-01' }, facebook: null },
    });

    expect(result.instagram.handle).toBe('creator');
    expect(result.facebook).toBeNull();
  });

  it('unwraps getConnectUrl so the authorizationUrl is readable for the redirect', () => {
    let result: any;
    service.getConnectUrl('instagram').subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/connect/instagram'));
    req.flush({ success: true, data: { authorizationUrl: 'https://facebook.com/dialog/oauth?x=1' } });

    expect(result.authorizationUrl).toBe('https://facebook.com/dialog/oauth?x=1');
  });

  it('passes through disconnectPlatform when the backend response already has a top-level success key (interceptor skip case)', () => {
    let result: any;
    service.disconnectPlatform('instagram').subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/disconnect/instagram'));
    // response.interceptor.ts skips wrapping when the payload already has a
    // `success` key — this is the shape disconnectPlatform's controller
    // returns, so there is no nested `data` to unwrap here.
    req.flush({ success: true });

    expect(result.success).toBe(true);
  });

  it('unwraps getAuditHistory entries including isPaid', () => {
    let result: any;
    service.getAuditHistory('u1', 20).subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/u1/history'));
    req.flush({
      success: true,
      data: {
        history: [
          { version: 2, collaborationScore: 82, campaignReadiness: 'Campaign Ready', trendstarzRecommended: true, isPaid: true, createdAt: '2026-07-26', scoreDelta: 12 },
        ],
      },
    });

    expect(result.history[0].isPaid).toBe(true);
  });

  it('unwraps getAuditVersion so a past audit snapshot is readable', () => {
    let result: any;
    service.getAuditVersion('u1', 1).subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/u1/version/1'));
    req.flush({ success: true, data: { userId: 'u1', version: 1, collaborationScore: 70 } });

    expect(result.version).toBe(1);
    expect(result.collaborationScore).toBe(70);
  });

  it('unwraps getSettings from the envelope', () => {
    let result: any;
    service.getSettings().subscribe((res) => (result = res));

    const req = httpMock.expectOne((r) => r.url.endsWith('/audit/settings'));
    req.flush({ success: true, data: { schemaVersion: 1, aiEnabled: true } });

    expect(result.schemaVersion).toBe(1);
    expect(result.aiEnabled).toBe(true);
  });
});
