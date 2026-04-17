import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TitleCasePipe, CommonModule } from '@angular/common';

@Component({
  selector: 'app-campaign-detail-modal',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  templateUrl: './campaign-detail-modal.component.html',
  styleUrls: ['./campaign-detail-modal.component.scss']
})
export class CampaignDetailModalComponent {
  @Input() invite: any;
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  // The following methods should be provided by the parent or moved here if needed:
  // getBrandLogo, getBrandInitial, getBrandName, getCampaignTitle, getCampaignCategories, etc.
}
