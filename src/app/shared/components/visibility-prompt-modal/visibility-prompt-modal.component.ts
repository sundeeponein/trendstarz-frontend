import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileVisibility } from '../../config.service';
import { ProfileVisibilitySelectorComponent } from '../profile-visibility-selector/profile-visibility-selector.component';

/**
 * Shown once at login for pre-existing accounts that never explicitly chose
 * a profileVisibility (isSet: false from getProfileVisibility) — gives them
 * an explicit opportunity to decide instead of silently defaulting forever.
 * Skippable; reappears on a future login until answered, since the account
 * remains "unset" until they choose.
 */
@Component({
  selector: 'app-visibility-prompt-modal',
  standalone: true,
  imports: [CommonModule, ProfileVisibilitySelectorComponent],
  templateUrl: './visibility-prompt-modal.component.html',
  styleUrls: ['./visibility-prompt-modal.component.scss'],
})
export class VisibilityPromptModalComponent {
  @Input() busy = false;
  @Output() choose = new EventEmitter<ProfileVisibility>();
  @Output() skip = new EventEmitter<void>();

  selected: ProfileVisibility = 'PUBLIC';

  onValueChange(value: ProfileVisibility): void {
    this.selected = value;
  }

  onSave(): void {
    if (this.busy) return;
    this.choose.emit(this.selected);
  }

  onSkip(): void {
    if (this.busy) return;
    this.skip.emit();
  }
}
