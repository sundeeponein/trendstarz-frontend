import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Campaign } from '../campaign.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './campaign-form.component.html',
  styleUrls: ['./campaign-form.component.scss']
})
export class CampaignFormComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() campaign: Campaign | null = null;
  @Output() save = new EventEmitter<Partial<Campaign>>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  imagePreview: string | null = null;
  selectedFile: File | null = null;
  uploading = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.form = this.fb.group({
      title: [this.campaign?.title || '', [Validators.required, Validators.minLength(3)]],
      description: [this.campaign?.description || ''],
      status: [this.campaign?.status || 'draft'],
      budgetMin: [this.campaign?.budgetMin || null, [Validators.min(0)]],
      budgetMax: [this.campaign?.budgetMax || null, [Validators.min(0)]],
      timelineStart: [this.formatDate(this.campaign?.timelineStart)],
      timelineEnd: [this.formatDate(this.campaign?.timelineEnd)],
    });

    if (this.campaign?.image?.url) {
      this.imagePreview = this.campaign.image.url;
    }
  }

  get isEdit(): boolean {
    return this.mode === 'edit';
  }

  get f() {
    return this.form.controls;
  }

  private formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toISOString().split('T')[0];
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  removeImage() {
    this.imagePreview = null;
    this.selectedFile = null;
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.uploading = true;
    const formValue = this.form.value;
    const payload: any = {
      title: formValue.title,
      description: formValue.description,
      status: formValue.status,
      budgetMin: formValue.budgetMin ? +formValue.budgetMin : undefined,
      budgetMax: formValue.budgetMax ? +formValue.budgetMax : undefined,
      timelineStart: formValue.timelineStart || undefined,
      timelineEnd: formValue.timelineEnd || undefined,
    };

    // Upload image to Cloudinary if a new file was selected
    if (this.selectedFile) {
      try {
        const uploaded = await this.uploadToCloudinary(this.selectedFile);
        payload.image = uploaded;
      } catch {
        this.uploading = false;
        return;
      }
    } else if (this.isEdit && this.campaign?.image) {
      payload.image = this.campaign.image;
    }

    this.uploading = false;
    this.save.emit(payload);
  }

  private async uploadToCloudinary(file: File): Promise<{ url: string; public_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinaryUploadPreset);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${environment.cloudinaryCloudName}/image/upload`,
      { method: 'POST', body: formData }
    );
    const data = await response.json();
    if (data.secure_url && data.public_id) {
      return { url: data.secure_url, public_id: data.public_id };
    }
    throw new Error('Image upload failed');
  }

  onCancel() {
    this.cancel.emit();
  }
}
