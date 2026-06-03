import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

type AvailabilityRole = 'influencer' | 'photographer';

@Component({
  selector: 'app-collaboration-availability-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="ca-form" [formGroup]="form" *ngIf="form">
      <h3 class="m-0">{{ role === 'influencer' ? 'Collaboration Availability' : 'Collaboration Availability' }} </h3> <small class="text-black">Improve your visibility and receive better collaboration invites from brands, photographers and agencies.</small>
      <label class="ca-toggle mt-4">
        <input type="checkbox" formControlName="enabled" [disabled]="readonly" />
        <span>{{ role === 'influencer' ? 'Open for Collaborations & Shoots' : 'Open for Collaborations' }}</span>
        <!-- <strong>Enable</strong> -->
      </label>

      <ng-container *ngIf="form.get('enabled')?.value">
        <div class="ca-field" *ngIf="role === 'influencer' && (!readonly || optionsForField('collaborationTypes', influencerOptions.collaborationTypes || []).length)">
          <label>Collaboration Types</label>
          <div class="ca-chip-row">
            <button type="button" class="ca-chip" *ngFor="let item of optionsForField('collaborationTypes', influencerOptions.collaborationTypes || [])"
              [class.selected]="has('collaborationTypes', item.name)" [disabled]="readonly"
              (click)="toggle('collaborationTypes', item.name)">
              {{ item.name }}
            </button>
          </div>
        </div>

        <div class="ca-field" *ngIf="!readonly || optionsForField('availableFor', roleOptions.availableFor || []).length">
          <label>{{ role === 'influencer' ? 'Collaboration Preference' : 'Preferred Collaboration Type' }}</label>
          <div class="ca-radio-row">
            <label class="ca-radio" *ngFor="let item of roleOptions.preferences || []">
              <input type="radio" formControlName="preference" [value]="item.name" [disabled]="readonly" />
              <span>{{ item.name }}</span>
            </label>
          </div>
        </div>

        <div class="ca-field" *ngIf="!readonly || optionsForField('availableFor', roleOptions.availableFor || []).length">
          <label>Available For</label>
          <div class="ca-chip-row">
            <button type="button" class="ca-chip" *ngFor="let item of optionsForField('availableFor', roleOptions.availableFor || [])"
              [class.selected]="has('availableFor', item.name)" [disabled]="readonly"
              (click)="toggle('availableFor', item.name)">
              {{ item.name }}
            </button>
          </div>
        </div>

        <label class="ca-toggle ca-toggle--compact">
          <input type="checkbox" formControlName="openToTravel" [disabled]="readonly" />
          <span>Open to Travel</span>
        </label>
      </ng-container>
    </section>
  `,
  styles: [`
    .ca-form { margin-top: 18px; padding: 16px; border: 1px solid #d8deea; border-radius: 12px; background: #fff; }
    .ca-form h3 { margin: 0 0 12px; color: #111827; font-size: 1.15rem; font-weight: 800; }
    .ca-toggle { display: flex; align-items: center; gap: 10px; color: #111827; font-weight: 700; margin-bottom: 12px; }
    .ca-toggle input { width: 18px; height: 18px; accent-color: #111827; }
    .ca-toggle strong { color: #64748b; font-size: 0.92rem; }
    .ca-toggle--compact { margin: 10px 0 0; }
    .ca-field { margin-top: 14px; }
    .ca-field > label { display: block; margin-bottom: 8px; color: #334155; font-weight: 800; }
    .ca-chip-row, .ca-radio-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .ca-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 14px;
      border-radius: 30px;
      border: 1.5px solid #d8deea;
      background: #fff;
      color: #111827;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      outline: none;
    }
    .ca-chip:hover:not(:disabled) { border-color: #f55b0a; color: #f55b0a; }
    .ca-chip.selected { background: #111827; border-color: #111827; color: #fff; }
    .ca-chip.selected:hover:not(:disabled) { background: #f55b0a; border-color: #f55b0a; color: #fff; }
    .ca-chip:disabled { opacity: 1; cursor: default; }
    .ca-radio { display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border: 1.5px solid #d8deea; border-radius: 30px; color: #111827; background: #fff; font-size: 0.82rem; font-weight: 600; }
    .ca-radio input { accent-color: #111827; }
  `],
})
export class CollaborationAvailabilityFormComponent {
  @Input() form!: FormGroup;
  @Input() role: AvailabilityRole = 'influencer';
  @Input() options: any = {};
  @Input() readonly = false;

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
    else list.push(value);
    control?.setValue(list);
    control?.markAsDirty();
  }
}
