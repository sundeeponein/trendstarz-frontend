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
  // Handle product image file selection and preview
  onProductImageFileChange(event: any, index: number) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    // Validate file size (must be below 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    this.productImagesFiles[index] = file;
    // Show preview
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.productImagesPreview[index] = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  // Handle brand logo file selection and preview
  onBrandLogoFileChange(event: any) {
    const file: File = event.target.files && event.target.files[0];
    if (!file) return;
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }
    // Validate file size (must be below 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be below 2MB.');
      return;
    }
    this.brandLogoFile = file;
    // Show preview
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.brandLogoPreview = e.target.result;
    };
    reader.readAsDataURL(file);
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
    if (this.registrationForm.invalid) return;
    this.registrationError = '';
    this.registrationSuccess = false;
    // Prepare payload to match backend DTO
    const raw = this.registrationForm.value;
    // Upload product images to Cloudinary if any
    let productImageObjs: { url: string, public_id: string }[] = [];
    if (this.productImagesFiles.length > 0) {
      for (let i = 0; i < this.productImagesFiles.length; i++) {
        const fileOrObj = this.productImagesFiles[i];
        if (!fileOrObj) continue;
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
            } else {
              this.registrationError = 'Product image upload failed.';
              return;
            }
          } catch (err) {
            this.registrationError = 'Product image upload failed.';
            return;
          }
        } else if (typeof fileOrObj === 'object' && fileOrObj !== null && 'url' in fileOrObj && 'public_id' in fileOrObj) {
          productImageObjs.push(fileOrObj as { url: string, public_id: string });
        }
      }
    }
    // Map social media platform ID to name (for backend compatibility)
    const socialMedia = (raw.socialMedia || []).map((sm: any) => {
      const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
      return {
        ...sm,
        platform: platformObj ? platformObj.name : sm.platform,
        followersCount: Number(sm.followersCount)
      };
    });

    // Handle Cloudinary upload for brand logo if file selected
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
        } else {
          this.registrationError = 'Image upload failed.';
          return;
        }
      } catch (err) {
        this.registrationError = 'Image upload failed.';
        return;
      }
    } else if (raw.brandLogo && Array.isArray(raw.brandLogo) && raw.brandLogo.length > 0) {
      brandLogoObjs = raw.brandLogo.filter((img: any) => img && typeof img === 'object' && 'url' in img && 'public_id' in img);
    }

    const payload: any = {
      ...raw,
      isPremium: raw.paymentOption === 'premium',
      socialMedia,
      brandLogo: brandLogoObjs,
      products: productImageObjs,
      contact: raw.contact,
      googleMapAddress: raw.googleMapAddress || '',
    };
    // Remove fields not in DTO
    delete payload.confirmPassword;
    delete payload.paymentOption;
    delete payload.productImages;
    this.configService.registerBrand(payload).subscribe({
      next: (savedBrand) => {
        this.registrationSuccess = true;
        // Patch the form with the saved data so previews show
        this.registrationForm.patchValue({
          ...savedBrand,
          brandLogo: undefined // We'll handle this below
        });
        // Patch FormArray for brandLogo
        const arr = this.brandLogoFormArray;
        arr.clear();
        (savedBrand.brandLogo || []).forEach((logo: string) => arr.push(this.fb.control(logo)));
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
