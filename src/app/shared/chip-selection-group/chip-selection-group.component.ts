import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-chip-selection-group',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chip-selection-group.component.html',
  styleUrls: ['./chip-selection-group.component.scss'],
})
export class ChipSelectionGroupComponent {
  @Input() label = '';
  @Input() sublabel = '';
  @Input() required = false;
  @Input() options: any[] = [];
  @Input() selected: string[] = [];
  @Input() max = 0;
  @Input() readonly = false;
  @Input() emptyText = 'Loading options…';
  @Input() valueKey = '';
  @Input() labelKey = 'name';
  @Input() compact = false;
  @Input() selectionMode: 'multiple' | 'single' = 'multiple';

  @Output() selectedChange = new EventEmitter<string[]>();

  get normalizedSelected(): string[] {
    return Array.isArray(this.selected) ? this.selected.map(v => String(v || '').trim()).filter(Boolean) : [];
  }

  get visibleOptions(): Array<{ value: string; label: string }> {
    const mapped = (Array.isArray(this.options) ? this.options : [])
      .map((item: any) => ({
        value: this.optionValue(item),
        label: this.optionLabel(item),
      }))
      .filter(item => !!item.value);

    if (!this.readonly) return mapped;

    const known = new Set(mapped.map(item => item.value));
    const missing = this.normalizedSelected
      .filter(value => !known.has(value))
      .map(value => ({ value, label: value }));
    return [...mapped, ...missing].filter(item => this.isSelected(item.value));
  }

  isSelected(value: string): boolean {
    return this.normalizedSelected.includes(String(value || '').trim());
  }

  isMaxed(value: string): boolean {
    if (this.selectionMode === 'single') return false;
    return this.max > 0 && !this.isSelected(value) && this.normalizedSelected.length >= this.max;
  }

  limitMessage(): string {
    return this.max > 0 && this.normalizedSelected.length >= this.max
      ? `Maximum ${this.max} selections allowed`
      : '';
  }

  toggle(value: string): void {
    if (this.readonly) return;
    const clean = String(value || '').trim();
    if (!clean) return;
    if (this.selectionMode === 'single') {
      this.selectedChange.emit(this.isSelected(clean) ? [] : [clean]);
      return;
    }
    const list = [...this.normalizedSelected];
    const idx = list.indexOf(clean);
    if (idx >= 0) list.splice(idx, 1);
    else {
      if (this.isMaxed(clean)) return;
      list.push(clean);
    }
    this.selectedChange.emit(list);
  }

  private optionValue(item: any): string {
    if (item === null || item === undefined) return '';
    if (typeof item !== 'object') return String(item || '').trim();
    const raw = this.valueKey ? item?.[this.valueKey] : (item?._id ?? item?.id ?? item?.name ?? item?.label);
    return String(raw || '').trim();
  }

  private optionLabel(item: any): string {
    if (item === null || item === undefined) return '';
    if (typeof item !== 'object') return String(item || '').trim();
    const raw = this.labelKey ? item?.[this.labelKey] : (item?.name ?? item?.label ?? item?._id ?? item?.id);
    return String(raw || '').trim();
  }
}
