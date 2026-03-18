import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { Campaign } from '../../shared/campaigns/campaign.model';
import { CampaignFormComponent } from '../../shared/campaigns/campaign-form/campaign-form.component';

type TabStatus = 'active' | 'pending' | 'completed' | 'draft';

@Component({
  selector: 'app-campaign-management',
  standalone: true,
  imports: [CommonModule, CampaignFormComponent],
  templateUrl: './campaign-management.component.html',
  styleUrls: ['./campaign-management.component.scss']
})
export class CampaignManagementComponent implements OnInit {
  campaigns: Campaign[] = [];
  brandId = '';
  brandName = '';
  loading = true;

  activeTab: TabStatus = 'active';
  pageSize = 10;
  currentPage = 1;

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingCampaign: Campaign | null = null;

  tabs: { key: TabStatus; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
  ];

  constructor(
    private config: ConfigService,
    private session: SessionService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      this.config.getBrandProfileById(token).subscribe({
        next: (profile: any) => {
          if (profile) {
            this.brandId = profile._id || '';
            this.brandName = profile.brandName || profile.name || '';
            const name = profile.brandName || profile.brandUsername || profile.name;
            if (name) {
              this.config.getCampaignsByBrandName(name).subscribe({
                next: (campaigns: any[]) => {
                  this.campaigns = campaigns;
                  this.loading = false;
                  this.cd.detectChanges();
                }
              });
            } else {
              this.loading = false;
            }
          } else {
            this.loading = false;
          }
          this.cd.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cd.detectChanges();
        }
      });
    } else {
      this.loading = false;
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

  openCreateForm() {
    this.editingCampaign = null;
    this.formMode = 'create';
    this.showForm = true;
  }

  onManage(campaign: Campaign) {
    this.editingCampaign = campaign;
    this.formMode = 'edit';
    this.showForm = true;
  }

  onFormSave(data: Partial<Campaign>) {
    if (this.formMode === 'edit' && this.editingCampaign?._id) {
      this.config.updateCampaign(this.editingCampaign._id, data).subscribe({
        next: (updated: Campaign) => {
          this.campaigns = this.campaigns.map(c => c._id === this.editingCampaign!._id ? { ...c, ...updated } : c);
          this.cd.detectChanges();
        }
      });
    } else {
      const payload: any = { ...data, brandId: this.brandId };
      this.config.createCampaign(payload).subscribe({
        next: (created: Campaign) => {
          this.campaigns = [...this.campaigns, created];
          this.cd.detectChanges();
        }
      });
    }
    this.closeForm();
  }

  onDelete(campaign: Campaign) {
    if (!campaign._id) return;
    this.config.deleteCampaign(campaign._id).subscribe({
      next: () => {
        this.campaigns = this.campaigns.filter(c => c._id !== campaign._id);
        this.cd.detectChanges();
      }
    });
  }

  closeForm() {
    this.showForm = false;
    this.editingCampaign = null;
  }

  formatBudget(c: Campaign): string {
    if (!c.budgetMin && !c.budgetMax) return '—';
    const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (c.budgetMin && c.budgetMax) return `${fmt(c.budgetMin)} - ${fmt(c.budgetMax)}`;
    return c.budgetMin ? fmt(c.budgetMin) : fmt(c.budgetMax!);
  }

  formatTimeline(c: Campaign): string {
    if (!c.timelineStart) return '—';
    const fmt = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    };
    const start = fmt(c.timelineStart);
    const end = c.timelineEnd ? fmt(c.timelineEnd) : '...';
    return `${start} - ${end}`;
  }

  timelineProgress(c: Campaign): number {
    if (!c.timelineStart || !c.timelineEnd) return 0;
    const start = new Date(c.timelineStart).getTime();
    const end = new Date(c.timelineEnd).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/default-profile.png';
  }
}
