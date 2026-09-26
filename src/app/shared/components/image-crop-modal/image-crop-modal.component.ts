import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
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
  resolvingUrl = false;
  resolvedFile: File | null = null;

  constructor(private cd: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageFile'] || changes['imageUrl']) {
      this.imageLoaded = false;
      this.croppedBlob = null;
      this.loadError = false;
      this.resolvedFile = null;
      // ngx-image-cropper sizes itself very differently (and incorrectly, for tall
      // images) when fed via [imageURL] vs [imageFile]. Fetch the URL ourselves and
      // always feed the cropper a File so both paths behave identically.
      if (!this.imageFile && this.imageUrl) {
        this.resolveImageUrl(this.imageUrl);
      }
    }
  }

  private async resolveImageUrl(url: string): Promise<void> {
    this.resolvingUrl = true;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const filename = url.split('/').pop()?.split('?')[0] || 'profile-image.jpg';
      this.resolvedFile = new File([blob], filename, { type: blob.type || 'image/jpeg' });
    } catch {
      this.loadError = true;
    } finally {
      this.resolvingUrl = false;
      this.cd.detectChanges();
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
    const sourceFile = this.effectiveImageFile;
    const filename = sourceFile?.name || 'profile-image.jpg';
    const file = new File([this.croppedBlob], filename, {
      type: this.croppedBlob.type || sourceFile?.type || 'image/jpeg',
    });
    this.cropped.emit(file);
  }

  get effectiveImageFile(): File | null {
    return this.imageFile || this.resolvedFile;
  }

  get hasSource(): boolean {
    return !!this.effectiveImageFile;
  }

  cancel(): void {
    this.closed.emit();
  }
}
