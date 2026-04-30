import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowHelpModalService } from './flow-help-modal.service';

@Component({
  selector: 'app-flow-help-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flow-help-modal.component.html',
  styleUrls: ['./flow-help-modal.component.scss']
})
export class FlowHelpModalComponent {
  protected readonly flowHelp = inject(FlowHelpModalService);
}
