import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Campaign, CampaignInfluencer } from '../../shared/campaigns/campaign.model';
import { ConfigService } from '../../shared/config.service';
import { PlansService } from '../../shared/plans.service';
import { ToastService } from '../../shared/toast/toast.service';
import { SessionService } from '../../core/session.service';
import { CampaignFormComponent } from '../../shared/campaigns/campaign-form/campaign-form.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, CampaignFormComponent],
  template: `
    <app-campaign-form
      [asPage]="true"
      [campaign]="campaign"
      [mode]="mode"
      [creatorRole]="creatorRole"
      [hasPremium]="hasPremium"
      [preSelectedInfluencers]="preSelectedInfluencers"
      [preSelectedRecipientRole]="preSelectedRecipientRole"
      [saving]="saving"
      [slotsFullLimit]="slotsFullLimit"
      (save)="onSave($event)"
      (cancel)="onCancel()"
    ></app-campaign-form>

    <!-- Some invites were not sent: say who and why before leaving the form. -->
    <div class="invite-results-backdrop" *ngIf="inviteFailures.length">
      <div class="invite-results" role="dialog" aria-modal="true" aria-labelledby="invite-results-title">
        <h5 id="invite-results-title">{{ inviteResultsTitle }}</h5>
        <p class="invite-results-lead">
          {{ inviteFailures.length === 1 ? 'This invite was' : 'These invites were' }} not sent:
        </p>
        <ul class="invite-results-list">
          <li *ngFor="let f of inviteFailures">
            <strong>{{ f.name }}</strong>: {{ f.reason }}
          </li>
        </ul>
        <button type="button" class="btn btn-primary" (click)="finishAfterInviteResults()">Done</button>
      </div>
    </div>
  `,
  styles: [
    `
      .invite-results-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1080;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .invite-results {
        background: #fff;
        border-radius: 12px;
        padding: 20px;
        width: 100%;
        max-width: 520px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      }
      .invite-results h5 {
        font-weight: 700;
        margin: 0 0 8px;
      }
      .invite-results-lead {
        color: #4b5563;
        margin: 0 0 8px;
      }
      .invite-results-list {
        padding-left: 1.1rem;
        margin: 0 0 16px;
      }
      .invite-results-list li {
        margin-bottom: 6px;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class CampaignFormPageComponent implements OnInit {
  campaign: Campaign | null = null;
  mode: 'create' | 'edit' = 'create';
  creatorRole: 'brand' | 'photographer' | 'influencer' = 'brand';
  hasPremium = false;
  saving = false;
  /** Set (to the plan limit) when a new campaign can't be saved because all slots are used. */
  slotsFullLimit: number | null = null;
  preSelectedInfluencers: CampaignInfluencer[] = [];
  preSelectedRecipientRole: 'influencer' | 'photographer' | null = null;
  /** Invites the server refused, with its reason — shown before leaving the form. */
  inviteFailures: Array<{ name: string; reason: string }> = [];
  inviteResultsTitle = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private config: ConfigService,
    private plans: PlansService,
    private toast: ToastService,
    private session: SessionService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const user = this.session.getUser();
    const role = String(user?.role || '').trim().toLowerCase();
    this.creatorRole = role === 'influencer'
      ? 'influencer'
      : (role === 'photographer' || role === 'videographer') ? 'photographer' : 'brand';

    this.plans.getMyCapabilities().subscribe({
      next: (caps: any) => {
        this.hasPremium = !!caps?.hasPremium;
        if (!this.route.snapshot.paramMap.get('id')) this.checkCampaignSlots(caps);
        this.cd.detectChanges();
      },
      error: () => { this.hasPremium = false; this.cd.detectChanges(); },
    });

    const id = this.route.snapshot.paramMap.get('id');
    const navState: any = (typeof history !== 'undefined' ? history.state : null) || {};
    if (id) {
      this.mode = 'edit';
      this.config.getCampaignById(id).subscribe({
        next: (c: any) => { this.campaign = c || null; this.cd.detectChanges(); },
        error: () => { this.toast.error('Failed to load campaign.'); this.campaign = null; this.cd.detectChanges(); }
      });
    } else if (navState && navState.prefill) {
      // Prefill new campaign from navigation state (duplicate flow)
      this.mode = 'create';
      this.campaign = navState.prefill as Campaign;
    } else {
      this.mode = 'create';
      this.campaign = null;
    }
    // Shortlist handed over from Search ("Pitch Roster") — preselects invitees in the invite step.
    if (!id && Array.isArray(navState?.preSelectedInfluencers)) {
      this.preSelectedInfluencers = navState.preSelectedInfluencers
        .filter((r: any) => r && r.id)
        .map((r: any) => ({ id: String(r.id), name: String(r.name || ''), username: r.username || undefined, profile: r.profile || undefined }));
      this.preSelectedRecipientRole = navState.preSelectedRecipientRole === 'photographer' ? 'photographer' : 'influencer';
    }
  }

  /**
   * Mirrors the backend create-time rule (campaigns.service create): active,
   * pending, draft and paused campaigns use a plan slot; -1 = unlimited.
   * Warns up front instead of failing after all three steps are filled.
   */
  private checkCampaignSlots(caps: any): void {
    const limit = Number((caps?.limits || []).find((l: any) => l?.key === 'maxActiveCampaigns')?.value ?? 1);
    const ownerId = this.getRequesterId();
    if (limit === -1 || !ownerId) return;
    this.config.getCampaignsByBrandId(ownerId).subscribe({
      next: (rows: any[]) => {
        const used = (Array.isArray(rows) ? rows : [])
          .filter((c: any) => ['active', 'pending', 'draft', 'paused'].includes(String(c?.status || '').toLowerCase()))
          .length;
        this.slotsFullLimit = used >= limit ? limit : null;
        this.cd.detectChanges();
      },
      error: () => {},
    });
  }

  /** "Done" on the invite results dialog. */
  finishAfterInviteResults(): void {
    this.inviteFailures = [];
    this.router.navigate(['/campaigns']);
  }

  onCancel(): void {
    this.router.navigate(['/campaigns']);
  }

  private getRequesterId(): string {
    const user = this.session.getUser() || {};
    return String(user?.userId || user?._id || user?.id || '').trim();
  }

  private resolveRecipientRole(payload: any): 'influencer' | 'photographer' {
    // Influencers create collaborations targeting photographers.
    if (this.creatorRole === 'influencer') return 'photographer';
    if (payload?.inviteRecipientRole === 'photographer') return 'photographer';
    if (payload?.inviteRecipientRole === 'influencer') return 'influencer';
    const existing = String((this.campaign as any)?.inviteRecipientRole || '').trim().toLowerCase();
    return existing === 'photographer' ? 'photographer' : 'influencer';
  }

  onSave(payload: any): void {
    if (this.saving) return;

    const requesterId = this.getRequesterId();
    if (!requesterId) {
      this.toast.error('Your session has expired. Please log in again.');
      return;
    }

    const { inviteInfluencerIds, inviteRecipientIds, inviteRecipientRole, inviteRecipientNames, ...campaignData } =
      payload || {};
    const recipientNames: Record<string, string> = inviteRecipientNames || {};
    const recipientRole = this.resolveRecipientRole(payload);
    const inviteIds: string[] = (Array.isArray(inviteRecipientIds) && inviteRecipientIds.length > 0)
      ? inviteRecipientIds
      : (Array.isArray(inviteInfluencerIds) ? inviteInfluencerIds : []);
    const campaignPayload = { ...campaignData, inviteRecipientRole: recipientRole, brandId: requesterId };
    const entityNoun = this.creatorRole === 'brand' ? 'Campaign' : 'Collaboration';

    this.saving = true;

    const sendInvitesAndFinish = (campaignId: string) => {
      const validIds = inviteIds.filter((recipientId) => !!recipientId);
      if (validIds.length === 0) {
        this.saving = false;
        this.toast.success(String(campaignData?.status || '') === 'draft'
          ? `${entityNoun} saved as draft. You can continue editing it later.`
          : `${entityNoun} ${this.mode === 'create' ? 'created' : 'updated'} successfully!`);
        this.router.navigate(['/campaigns']);
        return;
      }
      const request$ = recipientRole === 'photographer'
        ? this.config.invitePhotographers(campaignId, validIds)
        : this.config.inviteInfluencers(campaignId, validIds);
      request$.subscribe({
        next: (resp: any) => {
          this.saving = false;
          const sentCount: number = typeof resp?.count === 'number' ? resp.count : 0;
          const failures = Array.isArray(resp?.failures) ? resp.failures : [];
          const verb = this.mode === 'create' ? 'created' : 'updated';
          if (sentCount > 0 && failures.length === 0) {
            this.toast.success(`${entityNoun} ${verb} and invites sent!`);
            this.cd.detectChanges();
            this.router.navigate(['/campaigns']);
            return;
          }
          // Some or all invites were refused: the campaign is saved — show who and why, then leave on "Done".
          this.inviteResultsTitle = sentCount > 0
            ? `${entityNoun} ${verb}. ${sentCount} invite${sentCount === 1 ? '' : 's'} sent, ${failures.length} not sent.`
            : `${entityNoun} ${verb}, but no invites were sent.`;
          this.inviteFailures = failures.length
            ? failures.map((f: any) => {
                const id = String(f?.influencerId || f?.photographerId || '').trim();
                return {
                  name: recipientNames[id] || (id ? 'Creator' : 'All invites'),
                  reason: String(f?.reason || 'Could not send the invite.'),
                };
              })
            : [{ name: 'All invites', reason: 'The server did not send any invite.' }];
          this.cd.detectChanges();
        },
        error: () => {
          this.saving = false;
          this.toast.error(`${entityNoun} ${this.mode === 'create' ? 'created' : 'updated'}, but failed to send invites.`);
          this.cd.detectChanges();
          this.router.navigate(['/campaigns']);
        }
      });
    };

    if (this.mode === 'edit' && this.campaign && this.campaign._id) {
      const editingId = this.campaign._id;
      this.config.updateCampaign(editingId, campaignPayload).subscribe({
        next: () => sendInvitesAndFinish(editingId),
        error: (err: any) => {
          this.saving = false;
          this.toast.error(err?.error?.message || `Failed to update ${entityNoun.toLowerCase()}.`);
          this.cd.detectChanges();
        }
      });
    } else {
      this.config.createCampaign(campaignPayload).subscribe({
        next: (created: any) => {
          const createdId = String(
            created?._id || created?.id || created?.campaignId || created?.campaign?._id || '',
          ).trim();
          if (createdId) {
            sendInvitesAndFinish(createdId);
          } else {
            this.saving = false;
            this.toast.success(`${entityNoun} created successfully!`);
            this.cd.detectChanges();
            this.router.navigate(['/campaigns']);
          }
        },
        error: (err: any) => {
          this.saving = false;
          const msg = err?.error?.message || err?.message || `Failed to create ${entityNoun.toLowerCase()}. Please check your input and try again.`;
          this.toast.error(msg);
          this.cd.detectChanges();
        }
      });
    }
  }
}
