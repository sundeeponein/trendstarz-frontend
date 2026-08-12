import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CollaborationScoreApiService } from '../../services/collaboration-score-api.service';
import { ToastService } from '../toast/toast.service';
import { SocialPlatformFieldComponent, SocialPlatformFieldForm } from './social-platform-field.component';

describe('SocialPlatformFieldComponent', () => {
  let apiSpy: jasmine.SpyObj<CollaborationScoreApiService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  const instagramPlatform = { _id: 'p1', name: 'Instagram', icon: 'bi bi-instagram', color: '#e1306c', contentTypes: [] };
  const youtubePlatform = { _id: 'p2', name: 'YouTube', icon: 'bi bi-youtube', color: '#ff0000', contentTypes: [] };

  function emptyForm(): SocialPlatformFieldForm {
    return { handle: '', followersCount: '', tier: '', contentTypes: {} };
  }

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj<CollaborationScoreApiService>('CollaborationScoreApiService', [
      'getConnections',
      'getConnectUrl',
      'disconnectPlatform',
      'getPlatformFlags',
    ]);
    apiSpy.getConnections.and.returnValue(of({ instagram: null, facebook: null }));
    apiSpy.getPlatformFlags.and.returnValue(
      of({ platformsEnabled: { instagram: true, facebook: true, youtube: true, linkedin: true } }),
    );
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning']);

    await TestBed.configureTestingModule({
      imports: [SocialPlatformFieldComponent],
      providers: [
        { provide: CollaborationScoreApiService, useValue: apiSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  function createComponent(overrides: Partial<SocialPlatformFieldComponent> = {}) {
    const fixture = TestBed.createComponent(SocialPlatformFieldComponent);
    const component = fixture.componentInstance;
    component.platform = instagramPlatform;
    component.form = emptyForm();
    Object.assign(component, overrides);
    fixture.detectChanges();
    return { fixture, component };
  }

  it('does not call getConnections when allowConnect is false (registration)', () => {
    createComponent({ allowConnect: false, supportsOAuth: true });
    expect(apiSpy.getConnections).not.toHaveBeenCalled();
  });

  it('does not call getConnections for a platform that does not support OAuth', () => {
    createComponent({ platform: youtubePlatform, allowConnect: true, supportsOAuth: false });
    expect(apiSpy.getConnections).not.toHaveBeenCalled();
  });

  it('loads connection status when allowConnect and supportsOAuth are both true', () => {
    apiSpy.getConnections.and.returnValue(
      of({ instagram: { handle: 'creator_handle', followersCount: 1000, connectedAt: '2026-01-01' }, facebook: null }),
    );

    const { component } = createComponent({ allowConnect: true, supportsOAuth: true });

    expect(apiSpy.getConnections).toHaveBeenCalled();
    expect(component.connection).toEqual({ handle: 'creator_handle', followersCount: 1000, connectedAt: '2026-01-01' });
  });

  it('requests the Meta authorization URL for the platform on connect', () => {
    // No authorizationUrl in the response — asserts the request itself
    // without triggering a real browser navigation via window.location.
    apiSpy.getConnectUrl.and.returnValue(of({ authorizationUrl: '' }));
    const { component } = createComponent({ allowConnect: true, supportsOAuth: true });

    component.onConnect();

    expect(apiSpy.getConnectUrl).toHaveBeenCalledWith('instagram');
    expect(component.connecting).toBe(false);
  });

  it('does not attempt to navigate during SSR (PLATFORM_ID is server)', async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SocialPlatformFieldComponent],
      providers: [
        { provide: CollaborationScoreApiService, useValue: apiSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();
    apiSpy.getConnectUrl.and.returnValue(of({ authorizationUrl: 'https://facebook.com/dialog/oauth?x=1' }));
    const { component } = createComponent({ allowConnect: true, supportsOAuth: true });

    component.onConnect();

    expect(component.connecting).toBe(false);
  });

  it('shows an error toast and resets connecting state when getConnectUrl fails', () => {
    apiSpy.getConnectUrl.and.returnValue(throwError(() => new Error('boom')));
    const { component } = createComponent({ allowConnect: true, supportsOAuth: true });

    component.onConnect();

    expect(toastSpy.error).toHaveBeenCalled();
    expect(component.connecting).toBe(false);
  });

  it('disconnects after confirmation and clears the connection', () => {
    apiSpy.getConnections.and.returnValue(
      of({ instagram: { handle: 'creator_handle', followersCount: 1000, connectedAt: '2026-01-01' }, facebook: null }),
    );
    apiSpy.disconnectPlatform.and.returnValue(of({ success: true }));
    spyOn(window, 'confirm').and.returnValue(true);
    const { component } = createComponent({ allowConnect: true, supportsOAuth: true });
    const emitSpy = spyOn(component.connectionChanged, 'emit');

    component.onDisconnect();

    expect(apiSpy.disconnectPlatform).toHaveBeenCalledWith('instagram');
    expect(component.connection).toBeNull();
    expect(emitSpy).toHaveBeenCalled();
    expect(toastSpy.success).toHaveBeenCalled();
  });

  it('does not disconnect when the confirmation dialog is cancelled', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const { component } = createComponent({ allowConnect: true, supportsOAuth: true });

    component.onDisconnect();

    expect(apiSpy.disconnectPlatform).not.toHaveBeenCalled();
  });

  it('normalizes the handle on blur without erasing manually entered data', () => {
    const { component } = createComponent();
    component.form.handle = '@creator_handle';

    component.onHandleBlur();

    expect(component.form.handle).toBe('creator_handle');
  });

  it('emits changed when a manual field mutates', () => {
    const { component } = createComponent();
    const emitSpy = spyOn(component.changed, 'emit');

    component.onFieldChange();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('flags a missing handle via handleError when submitted', () => {
    const { component } = createComponent();
    component.form.handle = '';

    expect(component.handleError).toBeTruthy();
  });

  it('builds a profile URL from the handle for the Verify profile link', () => {
    const { component } = createComponent();
    component.form.handle = 'creator_handle';

    expect(component.profileUrl).toBe('https://instagram.com/creator_handle');
  });

  describe('admin platform toggles', () => {
    it('hides the Connect block entirely when an admin disables this platform\'s collector', () => {
      apiSpy.getPlatformFlags.and.returnValue(
        of({ platformsEnabled: { instagram: false, facebook: true, youtube: true, linkedin: true } }),
      );
      const { fixture } = createComponent({ allowConnect: true, supportsOAuth: true });

      expect(fixture.nativeElement.querySelector('.spf-connect-block')).toBeFalsy();
    });

    it('keeps manual handle/tier fields untouched even when the collector is disabled', () => {
      apiSpy.getPlatformFlags.and.returnValue(
        of({ platformsEnabled: { instagram: false, facebook: true, youtube: true, linkedin: true } }),
      );
      const { fixture } = createComponent({ allowConnect: true, supportsOAuth: true });

      expect(fixture.nativeElement.querySelector('input')).toBeTruthy();
    });

    it('shows the Connect block again once re-enabled (does not cache the disabled state)', () => {
      apiSpy.getPlatformFlags.and.returnValue(
        of({ platformsEnabled: { instagram: true, facebook: true, youtube: true, linkedin: true } }),
      );
      const { fixture } = createComponent({ allowConnect: true, supportsOAuth: true });

      expect(fixture.nativeElement.querySelector('.spf-connect-block')).toBeTruthy();
    });

    it('does not fetch platform flags for registration (allowConnect false)', () => {
      createComponent({ allowConnect: false, supportsOAuth: true });

      expect(apiSpy.getPlatformFlags).not.toHaveBeenCalled();
    });
  });
});
