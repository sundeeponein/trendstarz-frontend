import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ConfigService } from '../../config.service';
import { TermsConsentModalComponent } from './terms-consent-modal.component';

describe('TermsConsentModalComponent', () => {
  let fixture: ComponentFixture<TermsConsentModalComponent>;
  let component: TermsConsentModalComponent;
  let config: jasmine.SpyObj<ConfigService>;

  beforeEach(async () => {
    config = jasmine.createSpyObj<ConfigService>('ConfigService', ['acceptLegalConsent']);
    await TestBed.configureTestingModule({
      imports: [TermsConsentModalComponent],
      providers: [{ provide: ConfigService, useValue: config }],
    }).compileComponents();
    fixture = TestBed.createComponent(TermsConsentModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const agreeButton = () =>
    Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((b) =>
      b.textContent?.includes('Agree'),
    )!;

  it('links to both legal pages and needs the box ticked first', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual(['/terms-and-conditions', '/privacy-policy']);
    expect(agreeButton().disabled).toBeTrue();
    component.accept();
    expect(config.acceptLegalConsent).not.toHaveBeenCalled();
  });

  it('saves the yes and closes', () => {
    config.acceptLegalConsent.and.returnValue(of({ success: true }));
    const accepted = jasmine.createSpy('accepted');
    component.accepted.subscribe(accepted);
    component.agreed = true;
    component.accept();
    expect(config.acceptLegalConsent).toHaveBeenCalledTimes(1);
    expect(accepted).toHaveBeenCalled();
  });

  it('stays open with the reason when saving fails', () => {
    config.acceptLegalConsent.and.returnValue(throwError(() => ({ error: { message: 'Server down' } })));
    const accepted = jasmine.createSpy('accepted');
    component.accepted.subscribe(accepted);
    component.agreed = true;
    component.accept();
    fixture.detectChanges();
    expect(accepted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Server down');
  });

  it('offers a way out (log out) instead of the app', () => {
    const logout = jasmine.createSpy('logout');
    component.logout.subscribe(logout);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent?.includes('Log out'),
    )!;
    button.click();
    expect(logout).toHaveBeenCalled();
  });
});
