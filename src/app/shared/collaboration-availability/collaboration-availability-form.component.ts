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

  // Returns a Set of valid option names for a field from the current admin config.
  private validOptionNames(field: string): Set<string> {
    let options: any[] = [];
    if (field === 'collaborationTypes') options = this.influencerOptions.collaborationTypes || [];
    if (field === 'availableFor') options = this.roleOptions.availableFor || [];
    return new Set(options.map((o: any) => String(o?.name || o || '').trim()).filter(Boolean));
  }

  // Counts only values that exist in the current option list (ignores stale/renamed values).
  validSelectedCount(field: string): number {
    const list: string[] = this.form.get(field)?.value || [];
    if (!Array.isArray(list)) return 0;
    const valid = this.validOptionNames(field);
    return list.filter((v: string) => valid.has(v)).length;
  }

  isMaxed(field: string, value: string): boolean {
    const max = this.maxFor(field);
    return max > 0 && !this.has(field, value) && this.validSelectedCount(field) >= max;
  }

  limitMessage(field: string): string {
    const max = this.maxFor(field);
    return max > 0 && this.validSelectedCount(field) >= max
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
    // Strip stale values (not in current options) before applying the toggle
    // so they don't count against the limit or get re-saved.
    const valid = this.validOptionNames(field);
    let list = (Array.isArray(control?.value) ? [...control!.value] : [])
      .filter((v: string) => valid.has(v));
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
