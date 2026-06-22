import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ImageCroppedEvent, ImageCropperComponent, LoadedImage } from 'ngx-image-cropper';

@Component({
  selector: 'app-image-crop-modal',
  standalone: true,
  imports: [CommonModule, ImageCropperComponent],
  templateUrl: './image-crop-modal.component.html',
  styleUrls: ['./image-crop-modal.component.scss'],
})
export class ImageCropModalComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Adjust photo';
  @Input() imageFile: File | null = null;
  @Input() imageUrl: string | null = null;
  @Input() aspectRatio = 1;
  @Input() round = false;

  @Output() cropped = new EventEmitter<File>();
  @Output() closed = new EventEmitter<void>();

  private croppedBlob: Blob | null = null;
  imageLoaded = false;
  loadError = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageFile'] || changes['imageUrl']) {
      this.imageLoaded = false;
      this.croppedBlob = null;
      this.loadError = false;
    }
  }

  onImageLoaded(_image: LoadedImage): void {
    this.imageLoaded = true;
  }

  onImageCropped(event: ImageCroppedEvent): void {
    this.croppedBlob = event.blob ?? null;
  }

  onLoadImageFailed(): void {
    this.imageLoaded = false;
    this.loadError = true;
  }

  confirm(): void {
    if (!this.croppedBlob) return;
    const filename = this.imageFile?.name || 'profile-image.jpg';
    const file = new File([this.croppedBlob], filename, {
      type: this.croppedBlob.type || this.imageFile?.type || 'image/jpeg',
    });
    this.cropped.emit(file);
  }

  get hasSource(): boolean {
    return !!(this.imageFile || this.imageUrl);
  }

  cancel(): void {
    this.closed.emit();
  }
}
