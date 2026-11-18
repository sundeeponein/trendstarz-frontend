import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { AdminProfileModerationComponent } from './admin-profile-moderation.component';
import { ProfileVerificationService } from '../../../services/profile-verification.service';

describe('AdminProfileModerationComponent', () => {
  let component: AdminProfileModerationComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProfileVerificationService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    });

    const service = TestBed.inject(ProfileVerificationService);
    const route = TestBed.inject(ActivatedRoute);
    const http = TestBed.inject(HttpClient);
    component = new AdminProfileModerationComponent(service, route as any, http);
  });

  it('marks public profiles as discoverable when homepage eligibility passes', () => {
    const status = component.modDiscoveryStatus({
      profileVisibility: 'PUBLIC',
      homepageEligibility: {
        eligibleForHomepage: true,
        reasons: [],
      },
    } as any);

    expect(status.label).toBe('Discoverable');
    expect(status.tone).toBe('discoverable');
  });

  it('marks private profiles as hidden and recommends changing visibility', () => {
    const status = component.modDiscoveryStatus({
      profileVisibility: 'PRIVATE',
      homepageEligibility: {
        eligibleForHomepage: false,
        reasons: ['Profile visibility is not Public'],
      },
    } as any);

    expect(status.label).toBe('Hidden');
    expect(status.tone).toBe('hidden');
    expect(status.recommendation).toContain('Set visibility to Public');
  });
});
