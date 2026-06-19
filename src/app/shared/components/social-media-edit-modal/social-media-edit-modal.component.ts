import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TIER_DESC_MAP, TIER_ORDER } from '../../tiers.constants';

export interface AdminUser {
  id: string;
  name: string;
  role: string;
}

export interface SocialMediaEditPayload {
  handle: string;
  tier: string;
  changedBy: string;
  changedByName: string;
}

@Component({
  selector: 'app-social-media-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './social-media-edit-modal.component.html',
  styleUrls: ['./social-media-edit-modal.component.scss'],
})
export class SocialMediaEditModalComponent implements OnChanges {
  @Input() platform = '';
  @Input() platformLabel = '';
  @Input() platformIcon = '';
  @Input() handle = '';
  @Input() tier = '';
  @Input() currentAdmin: AdminUser | null = null;
  @Input() saving = false;
  @Input() error: string | null = null;

  @Output() save = new EventEmitter<SocialMediaEditPayload>();
  @Output() cancel = new EventEmitter<void>();

  editHandle = '';
  editTier = '';

  readonly tierOptions = TIER_ORDER.map(name => ({
    value: name,
    label: `${name} (${TIER_DESC_MAP[name.toLowerCase()] ?? ''})`,
  }));

  get todayLabel(): string {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  }

  get adminDisplayName(): string {
    if (!this.currentAdmin) return 'Unknown';
    const roleLabel = this.currentAdmin.role === 'subadmin' ? 'Sub-admin' : 'Main';
    return `${this.currentAdmin.name} (${roleLabel})`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['handle']) this.editHandle = this.handle;
    if (changes['tier']) this.editTier = this.tier;
  }

  onSave(): void {
    this.save.emit({
      handle: this.editHandle.trim().replace(/^@/, ''),
      tier: this.editTier,
      changedBy: this.currentAdmin?.id || '',
      changedByName: this.currentAdmin?.name || '',
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('smem-overlay')) {
      this.cancel.emit();
    }
  }
}
