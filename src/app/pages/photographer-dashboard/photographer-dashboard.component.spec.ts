import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PhotographerDashboardComponent } from './photographer-dashboard.component';
import { SessionService } from '../../core/session.service';
import { ConfigService } from '../../shared/config.service';
import { MonetizationApiService } from '../../services/monetization-api.service';
import { Router } from '@angular/router';

describe('PhotographerDashboardComponent usage summary', () => {
  async function createComponent(options?: { includeUsage?: boolean }) {
    const sessionStub = {
      getUser: () => ({ role: 'photographer' }),
      loadUserFromStorage: () => {},
      user$: of({ role: 'photographer' }),
    };

    const configStub = {
      getPhotographerProfileById: () => of({
        _id: 'p1',
        name: 'Alex Lens',
        username: 'alex-lens',
        status: 'accepted',
        createdAt: '2026-05-01T00:00:00.000Z',
        lastLoginAt: '2026-05-20T00:00:00.000Z',
        location: { state: 'Karnataka' },
        skills: ['portrait'],
        socialMedia: [{ platform: 'instagram' }],
      }),
      getAllCampaigns: () => of([]),
      getMyPhotographerInvites: () => of([]),
    };

    const monetizationStub = {
      getMyUsage: () => of({
        success: true,
        usage: options?.includeUsage === false
          ? null
          : {
              day: '2026-05-28',
              search: { used: 3, limit: 20, remaining: 17 },
              profileViews: { used: 7, limit: 40, remaining: 33 },
            },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [PhotographerDashboardComponent],
      providers: [
        { provide: SessionService, useValue: sessionStub },
        { provide: ConfigService, useValue: configStub },
        { provide: MonetizationApiService, useValue: monetizationStub },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhotographerDashboardComponent);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  it('renders daily usage counts in the welcome card', async () => {
    const fixture = await createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Daily profile views: 7/40');
    expect(text).toContain('Daily searches: 3/20');
  });

  it('does not render usage rows when usage is unavailable', async () => {
    const fixture = await createComponent({ includeUsage: false });
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Daily profile views:');
    expect(text).not.toContain('Daily searches:');
  });
});