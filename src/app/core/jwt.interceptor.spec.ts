import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { JwtInterceptor, sessionEndReason } from './jwt.interceptor';
import { SessionService } from './session.service';

describe('JwtInterceptor — a session the server refuses', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let session: jasmine.SpyObj<SessionService>;

  beforeEach(() => {
    localStorage.setItem('token', 'old-token');
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    session = jasmine.createSpyObj<SessionService>('SessionService', ['clearSession']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
        { provide: Router, useValue: router },
        { provide: SessionService, useValue: session },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });
  afterEach(() => localStorage.removeItem('token'));

  it('signs out and goes to login with the reason when an API call returns 401', () => {
    http.get('/api/dashboard/influencer').subscribe({ error: () => undefined });
    httpMock.expectOne('/api/dashboard/influencer').flush(
      { message: 'Your password was changed. Please log in again.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(session.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { sessionEnded: 'password' } });
  });

  it('leaves login/auth calls alone (a wrong password is not a session ending)', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    httpMock.expectOne('/api/auth/login').flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    expect(session.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('maps server messages to reasons', () => {
    expect(sessionEndReason('Your account has been deleted. Please contact support.')).toBe('deleted');
    expect(sessionEndReason('Invalid token')).toBe('expired');
  });
});
