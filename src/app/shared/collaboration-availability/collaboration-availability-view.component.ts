import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-collaboration-availability-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="ca-view" *ngIf="availability?.enabled">
      <h3>Collaboration Availability</h3>
      <div class="ca-row" *ngIf="availability.collaborationTypes?.length">
        <strong>Types</strong>
        <span *ngFor="let item of availability.collaborationTypes">{{ item }},</span>
      </div>
      <div class="ca-row border-top" *ngIf="availability.preference">
        <strong>Preference</strong>
        <span>{{ availability.preference }},</span>
      </div>
      <div class="ca-row border-top" *ngIf="availability.availableFor?.length">
        <strong>Available For</strong>
        <span *ngFor="let item of availability.availableFor">{{ item }},</span>
      </div>
      <div class="ca-row border-top" *ngIf="availability.openToTravel">
        <strong>Travel</strong>
        <span>Open to Travel</span>
      </div>
    </section>
  `,
  styles: [`
    .ca-view { margin-top: 18px; padding: 16px; border: 1px solid #d8deea; border-radius: 12px; background: #fff; }
    .ca-view h3 { margin: 0 0 12px; color: #111827; font-size: 1.05rem; font-weight: 800; }
    .ca-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
    .ca-row strong { width: 100%; color: #7a7a8e; font-weight: 400; }
    .ca-row span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px 14px 6px px;
      border-radius: 30px;
      // border: 1.5px solid #111827;
      // background: #111827;
      color: #111827;
      font-size: 0.82rem;
      font-weight: 600;
    }
  `],
})
export class CollaborationAvailabilityViewComponent {
  @Input() availability: any;
}
