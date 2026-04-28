import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Campaign } from '../campaign.model';
import { CampaignCardComponent } from '../campaign-card/campaign-card.component';
import { CampaignFormComponent } from '../campaign-form/campaign-form.component';

type TabStatus = 'active' | 'pending' | 'completed' | 'draft';

@Component({
  selector: 'app-campaign-list',
  standalone: true,
  imports: [CommonModule, CampaignCardComponent, CampaignFormComponent],
  templateUrl: './campaign-list.component.html',
  styleUrls: ['./campaign-list.component.scss']
})
export class CampaignListComponent implements OnChanges {
  @Input() campaigns: Campaign[] = [];
  @Input() brandName = '';
  @Input() isOwner = false;

  @Output() createCampaign = new EventEmitter<Partial<Campaign>>();
  @Output() editCampaign = new EventEmitter<{ id: string; data: Partial<Campaign> }>();
  @Output() deleteCampaign = new EventEmitter<string>();

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingCampaign: Campaign | null = null;

  activeTab: TabStatus = 'active';
  pageSize = 6;
  currentPage = 1;

  tabs: { key: TabStatus; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
  ];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['campaigns']) {
      this.currentPage = 1;
    }
  }

  getCount(status: TabStatus): number {
    return this.campaigns.filter(c => c.status === status).length;
  }

  get filtered(): Campaign[] {
    return this.campaigns.filter(c => c.status === this.activeTab);
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.pageSize) || 1;
  }

  get pagedCampaigns(): Campaign[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get showingFrom(): number {
    return this.filtered.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.currentPage * this.pageSize, this.filtered.length);
  }

  switchTab(tab: TabStatus) {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  onViewDetails(campaign: Campaign) {
    // placeholder — wire to routing or modal later
    // debug: view details
  }

  onManage(campaign: Campaign) {
    this.editingCampaign = campaign;
    this.formMode = 'edit';
    this.showForm = true;
  }

  openCreateForm() {
    this.editingCampaign = null;
    this.formMode = 'create';
    this.showForm = true;
  }

  onFormSave(data: Partial<Campaign>) {
    if (this.formMode === 'edit' && this.editingCampaign?._id) {
      this.editCampaign.emit({ id: this.editingCampaign._id, data });
    } else {
      this.createCampaign.emit(data);
    }
    this.closeForm();
  }

  closeForm() {
    this.showForm = false;
    this.editingCampaign = null;
  }
}
