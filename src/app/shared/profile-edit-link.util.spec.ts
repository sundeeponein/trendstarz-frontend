import { convertToParamMap } from '@angular/router';
import { socialEditLink, wantsSocialEdit } from './profile-edit-link.util';
import { creatorTierVerificationReminderMessage } from './whatsapp-messages.util';

describe('social edit link (admin WhatsApp reminder)', () => {
  it('opens each creator role on its own profile, Social Media step', () => {
    expect(socialEditLink('influencer')).toBe('https://trendstarz.in/influencer-profile?edit=social');
    expect(socialEditLink('photographer')).toBe('https://trendstarz.in/photographer-profile?edit=social');
    expect(socialEditLink('brand')).toBe('https://trendstarz.in/brand-profile');
  });

  it('the profile page recognises the link', () => {
    expect(wantsSocialEdit(convertToParamMap({ edit: 'social' }))).toBeTrue();
    expect(wantsSocialEdit(convertToParamMap({}))).toBeFalse();
  });

  it('the reminder carries the link', () => {
    const text = creatorTierVerificationReminderMessage({ name: 'Bunny', editLink: socialEditLink('influencer') });
    expect(text).toContain('Update them here (log in if asked):\nhttps://trendstarz.in/influencer-profile?edit=social');
    expect(creatorTierVerificationReminderMessage({ name: 'Bunny' })).not.toContain('http');
  });
});
