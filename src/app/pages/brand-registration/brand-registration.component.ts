import { environment } from '../../../environments/environment';
// Cloudinary configuration from Angular environment
const CLOUDINARY_UPLOAD_PRESET = environment.cloudinaryUploadPreset;
const CLOUDINARY_CLOUD_NAME = environment.cloudinaryCloudName;
// ...existing code...
import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-brand-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './brand-registration.component.html',
  styleUrls: ['./brand-registration.component.scss']
})
 
export class BrandRegistrationComponent implements OnInit {
  submitted = false;
  registrationSuccess = false;
  registrationError = '';
  registrationForm!: FormGroup;
  states: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];

  isPremium = false;
  languagesList: any[] = [];
  categoriesList: any[] = [];
  brandLogoPreview: string | null = null;
  brandLogoFile: File | null = null;
  productImagesPreview: (string | null)[] = [];
  productImagesFiles: (File | string | null)[] = [];
  addProductImage() {
    const maxImages = this.isPremium ? 5 : 1;
    if (this.productImagesPreview.length < maxImages) {
      this.productImagesPreview.push(null);
      this.productImagesFiles.push(null);
    }
  }

  removeProductImage(index: number) {
    this.productImagesPreview.splice(index, 1);
    this.productImagesFiles.splice(index, 1);
  }
  // Handle product image file selection, compress, upload, and preview
  async onProductImageFileChange(event: any, index: number) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.productImagesPreview[index] = null;
      this.productImagesFiles[index] = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
        this.productImagesPreview[index] = data.secure_url;
        this.productImagesFiles[index] = compressedFile;
      } else {
        this.registrationError = 'Product image upload failed.';
      }
    } catch (err) {
      this.registrationError = 'Product image upload failed.';
    }
  }
  // Handle brand logo file selection, compress, upload, and preview
  async onBrandLogoFileChange(event: any) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    // Compress image before upload
    const options = {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };
    try {
      const compressedFile = await imageCompression(file, options);
      // Upload to Cloudinary
      this.brandLogoPreview = null;
      this.brandLogoFile = null;
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url && data.public_id) {
        this.brandLogoPreview = data.secure_url;
        this.brandLogoFile = compressedFile;
      } else {
        this.registrationError = 'Brand logo upload failed.';
      }
    } catch (err) {
      this.registrationError = 'Brand logo upload failed.';
    }
  }
  constructor(public fb: FormBuilder, private configService: ConfigService) {}
  // Getter for brandLogo FormArray
  get brandLogoFormArray(): FormArray {
    return this.registrationForm.get('brandLogo') as FormArray;
  }

  addBrandLogo() {
    this.brandLogoFormArray.push(this.fb.control(''));
  }

  removeBrandLogo(index: number) {
    if (this.brandLogoFormArray.length > 1) {
      this.brandLogoFormArray.removeAt(index);
    }
  }

  ngOnInit() {
    this.registrationForm = this.fb.group({
      brandName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      isPremium: [false],
      paymentOption: ['', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required],
        googleMapLink: ['']
      }),
      categories: [[], Validators.required],
      languages: [[], Validators.required],
      website: [''],
      googleMapAddress: [''],
  brandLogo: this.fb.array([]),
      socialMedia: this.fb.array([
        this.fb.group({
          platform: ['', Validators.required],
          handle: ['', Validators.required],
          tier: ['', Validators.required],
          followersCount: ['', Validators.required]
        })
      ]),
      contact: this.fb.group({
        whatsapp: [false],
        email: [false],
        call: [false]
      }),
    });

  // Fetch dropdown data from API
  this.configService.getStates().subscribe(data => this.states = data);
  this.configService.getTiers().subscribe(data => this.tiers = data);
  this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
  this.configService.getLanguages().subscribe(data => this.languagesList = data);
  this.configService.getCategories().subscribe(data => this.categoriesList = data);
    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(val => {
      this.isPremium = val === 'premium';
    });
  }

  get socialMediaFormArray() {
    return this.registrationForm.get('socialMedia') as FormArray;
  }

  addSocialMedia() {
    this.socialMediaFormArray.push(this.fb.group({
      platform: ['', Validators.required],
      handle: ['', Validators.required],
      tier: ['', Validators.required],
      followersCount: ['', Validators.required]
    }));
  }

  removeSocialMedia(index: number) {
    if (this.socialMediaFormArray.length > 1) {
      this.socialMediaFormArray.removeAt(index);
    }
  }


  async onSubmit() {
    this.submitted = true;
    if (this.registrationForm.invalid || !this.brandLogoPreview) {
      if (!this.brandLogoPreview) {
        this.registrationError = 'Brand logo is required.';
      }
      return;
    }
    this.registrationError = '';
    this.registrationSuccess = false;
    const raw = this.registrationForm.value;
    // Prepare payload without images
    const payload: any = {
      ...raw,
      isPremium: raw.paymentOption === 'premium',
      socialMedia: (raw.socialMedia || []).map((sm: any) => {
        const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
        return {
          ...sm,
          platform: platformObj ? platformObj.name : sm.platform,
          followersCount: Number(sm.followersCount)
        };
      }),
      brandLogo: [],
      products: [],
      contact: raw.contact,
      googleMapAddress: raw.googleMapAddress || '',
    };
    delete payload.confirmPassword;
    delete payload.paymentOption;
    delete payload.productImages;

    // 1. Register brand (no images)
    this.configService.registerBrand(payload).subscribe({
      next: async (savedBrand) => {
        // 2. Upload images to Cloudinary
        let brandLogoObjs: { url: string, public_id: string }[] = [];
        if (this.brandLogoFile) {
          try {
            const formData = new FormData();
            formData.append('file', this.brandLogoFile);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
              method: 'POST',
              body: formData
            });
            const data = await response.json();
            if (data.secure_url && data.public_id) {
              brandLogoObjs = [{ url: data.secure_url, public_id: data.public_id }];
            }
          } catch (err) {
            this.registrationError = 'Image upload failed.';
            return;
          }
        }
        let productImageObjs: { url: string, public_id: string }[] = [];
        for (let i = 0; i < this.productImagesFiles.length; i++) {
          const fileOrObj = this.productImagesFiles[i];
          if (fileOrObj instanceof File) {
            try {
              const formData = new FormData();
              formData.append('file', fileOrObj);
              formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
              const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
              });
              const data = await response.json();
              if (data.secure_url && data.public_id) {
                productImageObjs.push({ url: data.secure_url, public_id: data.public_id });
              }
            } catch (err) {
              this.registrationError = 'Product image upload failed.';
              return;
            }
          }
        }
        // 3. Update brand with images
        console.log('Registration response:', savedBrand);
        const brandId = savedBrand._id || savedBrand.id;
        if (!brandId) {
          this.registrationError = 'Could not determine brand ID for image upload.';
          return;
        }
        this.configService.updateBrandImages(brandId, {
          brandLogo: brandLogoObjs,
          products: productImageObjs
        }).subscribe({
          next: () => {
            this.registrationSuccess = true;
            this.registrationForm.reset();
            this.brandLogoPreview = null;
            this.brandLogoFile = null;
            this.productImagesPreview = [];
            this.productImagesFiles = [];
            this.submitted = false;
          },
          error: () => {
            this.registrationError = 'Failed to update brand with images.';
          }
        });
      },
      error: (err: any) => {
        if (err?.error?.message && err.error.message.includes('already exists')) {
          this.registrationError = err.error.message;
        } else {
          this.registrationError = 'Registration failed. Please try again.';
        }
      }
    });
  }
}
