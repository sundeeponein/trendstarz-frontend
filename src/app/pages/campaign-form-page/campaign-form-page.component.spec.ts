import { of, throwError } from 'rxjs';
import { CampaignFormPageComponent } from './campaign-form-page.component';

/**
 * Saving a campaign with invites: when the server refuses some invites, the
 * page says who and why (from the server's failures) before leaving the form.
 */
describe('CampaignFormPageComponent — invite results', () => {
  const make = (inviteResponse: any) => {
    const router = { navigate: jasmine.createSpy('navigate') };
    const toast = jasmine.createSpyObj('toast', ['success', 'error']);
    const config = {
      createCampaign: jasmine.createSpy('createCampaign').and.returnValue(of({ _id: 'camp-1' })),
      inviteInfluencers: jasmine
        .createSpy('inviteInfluencers')
        .and.returnValue(
          inviteResponse instanceof Error ? throwError(() => inviteResponse) : of(inviteResponse),
        ),
      invitePhotographers: jasmine
        .createSpy('invitePhotographers')
        .and.returnValue(of({ count: 1, failures: [] })),
    };
    const page = new CampaignFormPageComponent(
      {} as any,
      router as any,
      config as any,
      {} as any,
      toast,
      { getUser: () => ({ userId: 'brand-1' }) } as any,
      { detectChanges: () => {} } as any,
    );
    return { page, router, toast, config };
  };
  const save = (page: CampaignFormPageComponent) =>
    page.onSave({
      title: 'Diwali',
      status: 'pending_review',
      inviteRecipientRole: 'influencer',
      inviteRecipientIds: ['a', 'b', 'c'],
      inviteRecipientNames: { a: 'Asha', b: 'Bala', c: 'Chitra' },
    });

  it('all invites sent → success toast and straight to Campaigns (unchanged)', () => {
    const { page, router, toast } = make({ count: 3, failures: [] });
    save(page);
    expect(toast.success).toHaveBeenCalledWith('Campaign created and invites sent!');
    expect(router.navigate).toHaveBeenCalledWith(['/campaigns']);
    expect(page.inviteFailures).toEqual([]);
  });

  it('some refused → stays on the page and lists who and why', () => {
    const { page, router } = make({
      count: 1,
      failures: [
        {
          influencerId: 'b',
          reason: 'This influencer has reached their monthly invite limit (1).',
        },
        {
          influencerId: 'c',
          reason: 'Plan limit: Only 2 invites per campaign allowed. Upgrade for more.',
        },
      ],
    });
    save(page);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(page.inviteResultsTitle).toBe('Campaign created. 1 invite sent, 2 not sent.');
    expect(page.inviteFailures).toEqual([
      { name: 'Bala', reason: 'This influencer has reached their monthly invite limit (1).' },
      {
        name: 'Chitra',
        reason: 'Plan limit: Only 2 invites per campaign allowed. Upgrade for more.',
      },
    ]);
    page.finishAfterInviteResults();
    expect(page.inviteFailures).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith(['/campaigns']);
  });

  it('none sent → explains each failure; unknown names fall back to "Creator"', () => {
    const { page } = make({
      count: 0,
      failures: [{ influencerId: 'zz', reason: 'Recipient is not approved.' }],
    });
    save(page);
    expect(page.inviteResultsTitle).toBe('Campaign created, but no invites were sent.');
    expect(page.inviteFailures).toEqual([
      { name: 'Creator', reason: 'Recipient is not approved.' },
    ]);
  });

  it('display names never reach the server', () => {
    const { page, config } = make({ count: 3, failures: [] });
    save(page);
    const sent = config.createCampaign.calls.mostRecent().args[0];
    expect(Object.keys(sent)).not.toContain('inviteRecipientNames');
    expect(config.inviteInfluencers).toHaveBeenCalledWith('camp-1', ['a', 'b', 'c']);
  });

  it('a failed invite request (network/server error) keeps the old behaviour', () => {
    const { page, router, toast } = make(new Error('boom'));
    save(page);
    expect(toast.error).toHaveBeenCalledWith('Campaign created, but failed to send invites.');
    expect(router.navigate).toHaveBeenCalledWith(['/campaigns']);
    expect(page.inviteFailures).toEqual([]);
  });
});
