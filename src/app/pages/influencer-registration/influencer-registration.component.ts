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
  socialMediaList: any[] = [];
  tiers: any[] = [];

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
      paymentOption: ['free', Validators.required],
      location: this.fb.group({
        state: ['', Validators.required]
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

  }

  get profileImagesFormArray() {
    return this.registrationForm.get('profileImages') as FormArray;
  }

  addProfileImage() {
  const maxImages = 1;
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
    // Map state ID to name
    const stateObj = this.states.find(s => s._id === raw.location.state);
    // Map language IDs to names
    const languageNames = (raw.languages || []).map((id: string) => {
      const lang = this.languagesList.find((l: any) => l._id === id);
      return lang ? lang.name : id;
    });
    // Map category IDs to names
    const categoryNames = (raw.categories || []).map((id: string) => {
      const cat = this.categoriesList.find((c: any) => c._id === id);
      return cat ? cat.name : id;
    });
    // Map social media platform ID to name
    const socialMedia = (raw.socialMedia || []).map((sm: any) => {
      const platformObj = this.socialMediaList.find((s: any) => s._id === sm.platform);
      return {
        ...sm,
        platform: platformObj ? platformObj.name : sm.platform,
        followersCount: Number(sm.followersCount)
      };
    });
    const payload: any = {
      ...raw,
      location: {
        state: stateObj ? stateObj.name : raw.location.state
      },
      languages: languageNames,
      categories: categoryNames,
      socialMedia,
      profileImages: raw.profileImages || [],
      contact: raw.contact
    };
  // console.log('Payload sent to backend:', payload);
    this.configService.registerInfluencer(payload).subscribe({
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
