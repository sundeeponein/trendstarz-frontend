import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowHelpModalService, FlowHelpDiagramContent, FlowHelpGuideContent } from './flow-help-modal.service';

@Component({
  selector: 'app-flow-help-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flow-help-modal.component.html',
  styleUrls: ['./flow-help-modal.component.scss']
})
export class FlowHelpModalComponent {
  protected readonly flowHelp = inject(FlowHelpModalService);

  get diagramContent(): FlowHelpDiagramContent | null {
    const c = this.flowHelp.content;
    return c?.mode === 'diagram' ? c as FlowHelpDiagramContent : null;
  }

  get guideContent(): FlowHelpGuideContent | null {
    const c = this.flowHelp.content;
    return (!c || c.mode === 'diagram') ? null : c as FlowHelpGuideContent;
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      brand: 'Brand', influencer: 'Influencer', admin: 'Admin', system: 'System'
    };
    return map[role] ?? role;
  }
}
