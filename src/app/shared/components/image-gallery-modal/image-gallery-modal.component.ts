import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-image-gallery-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-gallery-modal.component.html',
  styleUrls: ['./image-gallery-modal.component.scss'],
})
export class ImageGalleryModalComponent {
  @Input() open = false;
  @Input() title = 'Images';
  @Input() images: string[] = [];
  @Input() selectedIndex = 0;
  @Input() imageAlt = 'Selected image';
  @Input() thumbnailAlt = 'Image thumbnail';

  @Output() closed = new EventEmitter<void>();
  @Output() selectedIndexChange = new EventEmitter<number>();

  get safeSelectedIndex(): number {
    if (!this.images.length) return 0;
    return Math.max(0, Math.min(this.selectedIndex, this.images.length - 1));
  }

  select(index: number): void {
    if (!this.images.length) return;
    this.selectedIndexChange.emit(Math.max(0, Math.min(index, this.images.length - 1)));
  }

  close(): void {
    this.closed.emit();
  }
}
