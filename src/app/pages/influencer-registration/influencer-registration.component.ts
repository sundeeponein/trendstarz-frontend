import imageCompression from 'browser-image-compression';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ConfigService } from '../../shared/config.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-influencer-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './influencer-registration.component.html',
  styleUrls: ['./influencer-registration.component.scss']
})
export class InfluencerRegistrationComponent implements OnInit {
  registrationSuccess = false;
  registrationError = '';
  registrationForm!: FormGroup;
  states: any[] = [];
  districts: any[] = [];
  socialMediaList: any[] = [];
  tiers: any[] = [];

  isPremium = false;
  profileImages: string[] = [];
  languagesList: any[] = [];
  categoriesList: any[] = [];
  constructor(private fb: FormBuilder, private configService: ConfigService) {}

  ngOnInit() {
    this.registrationForm = this.fb.group({
      name: ['', Validators.required],
      username: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required],
      isPremium: [false],
      paymentOption: ['free', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required],
        district: [''] // optional
      }),
      languages: [[], Validators.required],
      categories: [[], Validators.required],
      profileImages: this.fb.array([]),
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
      })
    });
  // removed misplaced property declarations

  // Fetch dropdown data from API
  this.configService.getStates().subscribe(data => this.states = data);
  this.configService.getTiers().subscribe(data => this.tiers = data);
  this.configService.getSocialMedia().subscribe(data => this.socialMediaList = data);
  this.configService.getLanguages().subscribe(data => this.languagesList = data);
  this.configService.getCategories().subscribe(data => this.categoriesList = data);

    // Districts should be filtered by selected state (optional)
    this.registrationForm.get('location.state')?.valueChanges.subscribe(stateId => {
      if (stateId) {
        this.configService.getDistrictsByState(stateId).subscribe((data: any[]) => this.districts = data);
      } else {
        this.districts = [];
      }
    });

    this.registrationForm.get('paymentOption')?.valueChanges.subscribe(val => {
      this.isPremium = val === 'premium';
    });
  }

  get profileImagesFormArray() {
    return this.registrationForm.get('profileImages') as FormArray;
  }

  addProfileImage() {
    const maxImages = this.isPremium ? 3 : 1;
    if (this.profileImagesFormArray.length < maxImages) {
      this.profileImagesFormArray.push(this.fb.control('', Validators.required));
    }
  }

  removeProfileImage(index: number) {
    this.profileImagesFormArray.removeAt(index);
  }

    goToPayment() {
      // Save form if needed, then redirect to payment page
      window.location.href = '/payment';
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

  async onImageChange(event: any) {
    const files: FileList | null = event?.target?.files;
    if (!files || files.length === 0) return;
    const file: File = files[0];
    // Check file size
    if (file.size > 1024 * 1024) {
      alert('Image must be below 1MB.');
      return;
    }
    // Compress/resize
    const options = { maxWidthOrHeight: 1000, maxSizeMB: 1 };
    try {
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const arr = this.registrationForm.get('profileImages') as FormArray | null;
          if (arr) {
            arr.push(this.fb.control(result, Validators.required));
          }
        } else {
          alert('Failed to read image.');
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      alert('Image compression failed.');
    }
  }

  onSubmit() {
    if (this.registrationForm.invalid) return;
    this.registrationError = '';
    this.registrationSuccess = false;
    // Prepare payload to match backend DTO
    const raw = this.registrationForm.value;
    const payload: any = {
      ...raw,
      isPremium: raw.paymentOption === 'premium',
      location: {
        state: raw.location.state,
        district: raw.location.district || undefined // allow undefined
      },
      socialMedia: (raw.socialMedia || []).map((sm: any) => ({
        ...sm,
        followersCount: Number(sm.followersCount)
      })),
      profileImages: raw.profileImages || [],
      contact: raw.contact
    };
    // Remove fields not in DTO
    delete payload.confirmPassword;
    delete payload.paymentOption;
    this.configService.registerUser(payload).subscribe({
      next: () => {
        this.registrationSuccess = true;
        this.registrationForm.reset();
      },
      error: err => {
        this.registrationError = 'Registration failed. Please try again.';
      }
    });
  }


}
