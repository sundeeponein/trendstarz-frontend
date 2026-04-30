import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TierInfoService } from './tier-info.service';

@Component({
  selector: 'app-tier-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tier-info-modal.component.html',
  styleUrls: ['./tier-info-modal.component.scss']
})
export class TierInfoModalComponent {
  constructor(protected svc: TierInfoService) {}
}
