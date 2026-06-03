import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

type AvailabilityRole = 'influencer' | 'photographer';

@Component({
  selector: 'app-collaboration-availability-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './collaboration-availability-form.component.html',
  styleUrls: ['./collaboration-availability-form.component.scss'],
})
export class CollaborationAvailabilityFormComponent {
  @Input() form!: FormGroup;
  @Input() role: AvailabilityRole = 'influencer';
  @Input() options: any = {};
  @Input() readonly = false;
  @Input() maxCollaborationTypes = 0;
  @Input() maxAvailableFor = 0;

  get influencerOptions(): any {
    return this.options?.influencer || {};
  }

  get roleOptions(): any {
    return this.options?.[this.role] || {};
  }

  has(field: string, value: string): boolean {
    const list = this.form.get(field)?.value;
    return Array.isArray(list) && list.includes(value);
  }

  selectedCount(field: string): number {
    const list = this.form.get(field)?.value;
    return Array.isArray(list) ? list.length : 0;
  }

  isMaxed(field: string, value: string): boolean {
    const max = this.maxFor(field);
    return max > 0 && !this.has(field, value) && this.selectedCount(field) >= max;
  }

  limitMessage(field: string): string {
    const max = this.maxFor(field);
    return max > 0 && this.selectedCount(field) >= max
      ? `Maximum ${max} selections allowed`
      : '';
  }

  optionsForField(field: string, options: any[]): { name: string }[] {
    if (!this.readonly) return options || [];
    const selected = this.form.get(field)?.value;
    if (!Array.isArray(selected)) return [];
    return selected
      .map((name: any) => ({ name: String(name || '').trim() }))
      .filter((item: { name: string }) => !!item.name);
  }

  toggle(field: string, value: string): void {
    if (this.readonly) return;
    const control = this.form.get(field);
    const list = Array.isArray(control?.value) ? [...control!.value] : [];
    const idx = list.indexOf(value);
    if (idx >= 0) list.splice(idx, 1);
    else if (this.isMaxed(field, value)) return;
    else list.push(value);
    control?.setValue(list);
    control?.markAsDirty();
  }

  private maxFor(field: string): number {
    if (field === 'collaborationTypes') return this.maxCollaborationTypes;
    if (field === 'availableFor') return this.maxAvailableFor;
    return 0;
  }
}
