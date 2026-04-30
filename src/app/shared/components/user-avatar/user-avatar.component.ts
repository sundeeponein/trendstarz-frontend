import { Component, Input, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.scss']
})
export class UserAvatarComponent {
  /** Display name used to generate initials and pick a background colour */
  @Input() name = '';
  /** Pre-resolved image URL. Pass empty string or omit if no real photo. */
  @Input() src = '';
  /** Width / height in px (circle is always square). Default 44. */
  @Input() size = 44;

  @HostBinding('style.width.px') get hostWidth() { return this.size; }
  @HostBinding('style.height.px') get hostHeight() { return this.size; }
  @HostBinding('style.background') get hostBg() { return this.bgColor; }
  @HostBinding('style.--ua-size') get hostSize() { return this.size + 'px'; }

  get initials(): string {
    const n = String(this.name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase() || '?';
    const first = parts[0].charAt(0).toUpperCase() || '';
    const last = parts[parts.length - 1].charAt(0).toUpperCase() || '';
    return (first + last) || first || '?';
  }

  get bgColor(): string {
    const colors = ['#e8612d', '#2b6cb0', '#22b37a', '#805ad5', '#d69e2e', '#c53030', '#2c7a7b', '#b7791f'];
    if (!this.name) return colors[0];
    let hash = 0;
    for (let i = 0; i < this.name.length; i++) hash = this.name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
