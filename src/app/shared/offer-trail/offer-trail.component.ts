import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  buildAdminOfferTotalText,
  buildAdminOfferTrailText,
  buildUserPriceTrailText,
} from '../offer-trail.util';

export type OfferTrailMode = 'host' | 'admin' | 'receiver';
export type OfferTrailAction = 'accept' | 'counter' | 'decline';

@Component({
  selector: 'app-offer-trail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="mode === 'admin'">
      <div class="offer-trail-admin-meta" *ngIf="adminTrailText">{{ adminTrailText }}</div>
      <div class="offer-trail-admin-meta" *ngIf="adminTotalText">{{ adminTotalText }}</div>
    </ng-container>

    <ng-container *ngIf="mode === 'receiver'">
      <div *ngIf="receiverAppearance === 'box'" class="offer-trail-receiver" [class.offer-trail-receiver--hidden]="!receiverTrailText">
        <ng-container *ngIf="receiverTrailText">{{ receiverTrailText }}</ng-container>
      </div>

      <small *ngIf="receiverAppearance === 'inline' && receiverTrailText" class="offer-trail-inline">
        <i *ngIf="receiverIconClass" [class]="receiverIconClass"></i>
        {{ receiverTrailText }}
      </small>
    </ng-container>

    <div class="offer-trail-host" *ngIf="mode === 'host' && hostTrailText">
      <small class="offer-trail-host__note">{{ hostTrailText }}</small>
      <div class="offer-trail-host__actions" *ngIf="showActions && canRespond">
        <button
          class="offer-trail-btn offer-trail-btn--accept"
          type="button"
          [disabled]="busy"
          (click)="emitAction('accept', $event)">
          <i class="bi bi-check2-circle"></i> Accept Counter
        </button>
        <button
          class="offer-trail-btn offer-trail-btn--revise"
          type="button"
          [disabled]="busy"
          (click)="emitAction('counter', $event)">
          <i class="bi bi-arrow-left-right"></i> Send Revised Offer
        </button>
        <button
          class="offer-trail-btn offer-trail-btn--decline"
          type="button"
          [disabled]="busy"
          (click)="emitAction('decline', $event)">
          <i class="bi bi-x-circle"></i> Decline Counter
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .offer-trail-host {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 220px;
      }

      .offer-trail-host__note {
        font-size: 0.7rem;
        color: #475569;
      }

      .offer-trail-host__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .offer-trail-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 12px;
        border: 1px solid #d6dae1;
        background: #fff;
        color: #1f2937;
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s;
      }

      .offer-trail-btn i {
        font-size: 0.7rem;
      }

      .offer-trail-btn:hover:not(:disabled) {
        background: #f5f5f5;
      }

      .offer-trail-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .offer-trail-btn--accept {
        color: #14532d;
        border-color: rgba(20, 83, 45, 0.22);
      }

      .offer-trail-btn--accept:hover:not(:disabled) {
        background: rgba(34, 197, 94, 0.12);
      }

      .offer-trail-btn--revise {
        color: #1e3a8a;
        border-color: rgba(30, 58, 138, 0.24);
      }

      .offer-trail-btn--revise:hover:not(:disabled) {
        background: rgba(59, 130, 246, 0.12);
      }

      .offer-trail-btn--decline {
        color: #9f1239;
        border-color: rgba(190, 24, 93, 0.22);
      }

      .offer-trail-btn--decline:hover:not(:disabled) {
        background: rgba(244, 63, 94, 0.1);
      }

      .offer-trail-admin-meta {
        font-size: 0.78rem;
        color: #6b7280;
        margin-top: 2px;
      }

      .offer-trail-receiver {
        margin: -4px 0 16px;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid #e6edf8;
        background: #f7fbff;
        font-size: 0.84rem;
        color: #334155;
        font-weight: 600;
      }

      .offer-trail-receiver--hidden {
        display: none;
      }

      .offer-trail-inline {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.75rem;
        color: #64748b;
      }

      .offer-trail-inline i {
        font-size: 0.85rem;
      }
    `,
  ],
})
export class OfferTrailComponent {
  @Input() source: any;
  @Input() campaignContext?: any;
  @Input() mode: OfferTrailMode = 'host';
  @Input() receiverAppearance: 'box' | 'inline' = 'box';
  @Input() receiverIconClass = '';
  @Input() showActions = false;
  @Input() canRespond = false;
  @Input() busy = false;

  @Output() action = new EventEmitter<OfferTrailAction>();

  private get sourceWithCampaignAmount(): any {
    return {
      ...this.source,
      campaign: this.campaignContext,
      campaignAmountPaise: Number(
        this.source?.campaignAmountPaise
        || this.campaignContext?.pricePerInfluencer
        || this.campaignContext?.amount
        || 0,
      ),
    };
  }

  get hostTrailText(): string {
    return buildAdminOfferTrailText(this.sourceWithCampaignAmount);
  }

  get adminTrailText(): string {
    return buildAdminOfferTrailText(this.sourceWithCampaignAmount);
  }

  get adminTotalText(): string {
    return buildAdminOfferTotalText(this.sourceWithCampaignAmount);
  }

  get receiverTrailText(): string {
    return buildUserPriceTrailText(this.sourceWithCampaignAmount);
  }

  emitAction(action: OfferTrailAction, event: Event): void {
    event.stopPropagation();
    this.action.emit(action);
  }
}