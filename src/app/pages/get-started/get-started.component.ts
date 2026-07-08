import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

export type GetStartedRole = 'influencer' | 'brand' | 'photographer';

interface RoleStep {
  title: string;
  description: string;
}

interface RoleCard {
  id: GetStartedRole;
  tint: GetStartedRole;
  icon: string;
  eyebrow: string;
  title: string;
  tagline: string;
  steps: RoleStep[];
  whyHeading: string;
  whyPoints: string[];
  ctaLabel: string;
  registerRoute: string;
  learnMoreRoute: string;
}

@Component({
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.scss',
})
export class GetStartedComponent {
  readonly roleCards: RoleCard[] = [
    {
      id: 'influencer',
      tint: 'influencer',
      icon: 'bi-person-video3',
      eyebrow: 'For Creators',
      title: 'Influencer / Creator',
      tagline: 'Get paid brand collaborations without chasing DMs.',
      steps: [
        { title: 'Create Your Profile', description: 'Add your Instagram or YouTube and set your starting price.' },
        { title: 'Get Matched with Brands', description: 'Brands find you based on budget, category fit, and engagement.' },
        { title: 'Accept Offers', description: 'Accept, reject, or negotiate deals on your terms within the app.' },
      ],
      whyHeading: 'Why Influencers Join TrendStarz',
      whyPoints: [
        'Paid collaborations that fit your niche',
        'No need to pitch brands manually',
        'Flexible pricing and deal control',
        'Contact privacy stays protected',
      ],
      ctaLabel: 'Register as Influencer',
      registerRoute: '/register-influencer',
      learnMoreRoute: '/how-it-works/influencers',
    },
    {
      id: 'brand',
      tint: 'brand',
      icon: 'bi-briefcase-fill',
      eyebrow: 'For Businesses',
      title: 'Brand / Business',
      tagline: 'Find the right creators for campaigns that move your business forward.',
      steps: [
        { title: 'Create a Campaign', description: 'Define budget, content type, and campaign goal in minutes.' },
        { title: 'Discover Talent', description: 'Get matched profiles instantly or browse our verified database.' },
        { title: 'Send Offers', description: 'Negotiate quickly and finalize deals with escrow-backed payments.' },
      ],
      whyHeading: 'Why Brands Use TrendStarz',
      whyPoints: [
        'Find relevant creators 10x faster',
        'Work within your specific budget',
        'Verified, quality-checked profiles',
        'Transparent pricing and ROI tracking',
      ],
      ctaLabel: 'Register as Brand',
      registerRoute: '/register-brand',
      learnMoreRoute: '/how-it-works/brands',
    },
    {
      id: 'photographer',
      tint: 'photographer',
      icon: 'bi-camera-fill',
      eyebrow: 'For Visual Creators',
      title: 'Photographer / Videographer',
      tagline: 'Get photography and videography collaborations with clear deliverables.',
      steps: [
        { title: 'Create Your Portfolio', description: 'Add portfolio, equipment, and shoot categories.' },
        { title: 'Receive Requests', description: 'See matches based on your skills and location.' },
        { title: 'Accept & Deliver', description: 'Finalize scope, shoot, and submit through the workflow.' },
      ],
      whyHeading: 'Why Photo/Videographers Join Us',
      whyPoints: [
        'Guaranteed payment through escrow',
        'Detailed shoot briefs provided',
        'Automated rights management',
        'Collaborate with brands and creators',
      ],
      ctaLabel: 'Register as Photographer',
      registerRoute: '/register-photographer',
      learnMoreRoute: '/how-it-works/photographers',
    },
  ];

  constructor(private readonly meta: Meta, private readonly title: Title) {
    this.title.setTitle('Get Started on TrendStarz | Choose Your Role');
    this.meta.addTags([
      {
        name: 'description',
        content:
          'Join TrendStarz as an Influencer, Brand, or Photographer/Videographer. See how it works and why TrendStarz exists for your role, then register in minutes.',
      },
      { property: 'og:title', content: 'Get Started on TrendStarz' },
      {
        property: 'og:description',
        content: 'Choose your role — Influencer, Brand, or Photographer/Videographer — and register on TrendStarz.',
      },
      { property: 'og:type', content: 'website' },
    ]);
  }

  registerParams(role: GetStartedRole) {
    return { source: 'get-started', audience: role };
  }
}
