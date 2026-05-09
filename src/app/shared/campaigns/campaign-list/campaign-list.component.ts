import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Campaign } from '../campaign.model';
import { CampaignCardComponent } from '../campaign-card/campaign-card.component';
import { CampaignFormComponent } from '../campaign-form/campaign-form.component';
import { CampaignDetailModalComponent } from '../../campaign-detail-modal/campaign-detail-modal.component';

type TabStatus = 'active' | 'pending' | 'completed' | 'draft';

@Component({
  selector: 'app-campaign-list',
  standalone: true,
  imports: [CommonModule, CampaignCardComponent, CampaignFormComponent, CampaignDetailModalComponent],
  templateUrl: './campaign-list.component.html',
  styleUrls: ['./campaign-list.component.scss']
})
export class CampaignListComponent implements OnChanges {
  @Input() campaigns: Campaign[] = [];
  @Input() brandName = '';
  @Input() isOwner = false;
  @Input() externalDetailHandling = false;
  @Input() limitedCards = false;

  @Output() createCampaign = new EventEmitter<Partial<Campaign>>();
  @Output() editCampaign = new EventEmitter<{ id: string; data: Partial<Campaign> }>();
  @Output() deleteCampaign = new EventEmitter<string>();
  @Output() viewDetails = new EventEmitter<Campaign>();

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingCampaign: Campaign | null = null;
  selectedCampaign: Campaign | null = null;

  activeTab: TabStatus = 'active';
  pageSize = 6;
  currentPage = 1;

  tabs: { key: TabStatus; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
  ];

  get visibleTabs(): { key: TabStatus; label: string }[] {
    if (this.isOwner) return this.tabs;
    return this.tabs.filter((tab) => tab.key === 'active' || tab.key === 'completed');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['campaigns']) {
      this.currentPage = 1;
    }
    if (!this.visibleTabs.some((tab) => tab.key === this.activeTab)) {
      this.activeTab = this.visibleTabs[0]?.key || 'active';
    }
  }

  private statusKey(status: unknown): TabStatus | '' {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'active' || normalized === 'pending' || normalized === 'completed' || normalized === 'draft') {
      return normalized;
    }
    return '';
  }

  getCount(status: TabStatus): number {
    return this.campaigns.filter((campaign) => this.statusKey(campaign?.status) === status).length;
  }

  get filtered(): Campaign[] {
    return this.campaigns.filter((campaign) => this.statusKey(campaign?.status) === this.activeTab);
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
    if (this.externalDetailHandling) {
      this.viewDetails.emit(campaign);
      return;
    }
    this.selectedCampaign = campaign;
  }

  closeDetails() {
    this.selectedCampaign = null;
  }

  get selectedCampaignInvite(): any | null {
    if (!this.selectedCampaign) return null;
    return {
      _id: this.selectedCampaign._id || 'campaign-preview',
      status: 'accepted',
      campaign: this.selectedCampaign,
      brandId: {
        brandName: this.brandName,
      },
    };
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
