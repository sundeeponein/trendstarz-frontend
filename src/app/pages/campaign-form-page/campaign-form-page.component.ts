import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Campaign } from '../../shared/campaigns/campaign.model';
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
      [saving]="saving"
      (save)="onSave($event)"
      (cancel)="onCancel()"
    ></app-campaign-form>
  `,
})
export class CampaignFormPageComponent implements OnInit {
  campaign: Campaign | null = null;
  mode: 'create' | 'edit' = 'create';
  creatorRole: 'brand' | 'photographer' | 'influencer' = 'brand';
  hasPremium = false;
  saving = false;

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
      next: (caps: any) => { this.hasPremium = !!caps?.hasPremium; this.cd.detectChanges(); },
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

    const { inviteInfluencerIds, inviteRecipientIds, inviteRecipientRole, ...campaignData } = payload || {};
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
        this.toast.success(`${entityNoun} ${this.mode === 'create' ? 'created' : 'updated'} successfully!`);
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
          } else if (sentCount > 0) {
            this.toast.success(`${entityNoun} ${verb}. ${sentCount} invite(s) sent, ${failures.length} failed.`);
          } else {
            this.toast.error(`${entityNoun} ${verb}, but no invites were sent.`);
          }
          this.cd.detectChanges();
          this.router.navigate(['/campaigns']);
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
