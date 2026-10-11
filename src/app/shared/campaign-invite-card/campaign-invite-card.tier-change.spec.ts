import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CampaignInviteCardComponent } from './campaign-invite-card.component';

describe('CampaignInviteCardComponent — tier changed after the invite', () => {
  const render = (invite: any) => {
    TestBed.configureTestingModule({
      imports: [CampaignInviteCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(CampaignInviteCardComponent);
    fixture.componentInstance.invite = invite;
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('.cic-tier-change');
  };
  const change = [{ platform: 'YouTube', tier: 'Micro', changedAt: '2026-10-10T03:00:00.000Z' }];

  it('an open invite tells the creator their tier changed and that they can counter-offer', () => {
    const note = render({ _id: 'i1', status: 'pending', campaignId: { status: 'active' }, tierChangedSinceInvite: change });
    expect(note).not.toBeNull();
    expect(note!.textContent!.replace(/\s+/g, ' ')).toContain('Your YouTube tier changed to Micro on 10 Oct');
    expect(note!.textContent).toContain('after this invite was sent');
  });

  it('no note without a change', () => {
    expect(render({ _id: 'i1', status: 'pending', campaignId: { status: 'active' } })).toBeNull();
  });
});
