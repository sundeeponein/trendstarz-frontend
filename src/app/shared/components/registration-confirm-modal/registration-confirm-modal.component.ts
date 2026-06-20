import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistrationConfirmModalService, RegistrationRole } from './registration-confirm-modal.service';

interface RoleConfig {
  emoji: string;
  title: string;
  heading: string;
  points: string[];
  buttonLabel: string;
}

const ROLE_CONFIG: Record<RegistrationRole, RoleConfig> = {
  influencer: {
    emoji: '',
    title: 'Influencer / Creator',
    heading: 'Join as an Influencer / Creator',
    points: [
      'I want to receive collaboration opportunities from brands.',
      'I want to promote products, services, events, or businesses through my social media accounts.',
      'I understand that registering as an Influencer does not guarantee paid campaigns.',
    ],
    buttonLabel: 'Continue as Influencer',
  },
  brand: {
    emoji: '',
    title: 'Brand / Business',
    heading: 'Join as a Brand / Business',
    points: [
      'I am registering to hire Influencers, Creators, Photographers, or Videographers.',
      'I want to promote my business, products, services, or campaigns.',
      'I understand this account is for marketing and collaboration management.',
    ],
    buttonLabel: 'Continue as Brand',
  },
  photographer: {
    emoji: '',
    title: 'Photographer / Videographer',
    heading: 'Join as a Photographer / Videographer',
    points: [
      'I am registering to provide photography, videography, editing, or production services.',
      'I want to collaborate with Brands and Influencers.',
      'I understand this account is not an Influencer profile.',
    ],
    buttonLabel: 'Continue as Photographer / Videographer',
  },
};

@Component({
  selector: 'app-registration-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registration-confirm-modal.component.html',
  styleUrls: ['./registration-confirm-modal.component.scss'],
})
export class RegistrationConfirmModalComponent {
  protected readonly modal = inject(RegistrationConfirmModalService);

  get config(): RoleConfig | null {
    return this.modal.role ? ROLE_CONFIG[this.modal.role] : null;
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('rcm-overlay')) {
      this.modal.close();
    }
  }
}
