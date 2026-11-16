import { shortlistMessage, signupMessage } from './shortlist-message.util';

describe('shortlist WhatsApp message (2026-11-16)', () => {
  const request = { name: 'Asha', businessName: 'Asha Foods', city: 'Warangal', state: 'Telangana' };
  const creator = {
    name: 'Ravi Kumar', city: 'Warangal', username: 'ravi-k',
    accounts: [{ platform: 'Instagram', handle: 'ravi.eats', tier: 'Micro', verified: true }],
    rate: { name: 'Reel', price: 1500 },
  };

  it('lists the picked creators with handle, tier, rate and profile link, then the signup link', () => {
    const text = shortlistMessage(request, [creator], 'https://trendstarz.in/', 'https://trendstarz.in/register-brand?shortlist=x');
    expect(text).toContain('Hi Asha, this is TrendStarZ. Here is 1 creator for Asha Foods near Warangal, Telangana:');
    expect(text).toContain('1. Ravi Kumar, Warangal');
    expect(text).toContain('Instagram @ravi.eats (Micro, tier verified) · Reel ₹1,500');
    expect(text).toContain('https://trendstarz.in/influencer/ravi-k');
    expect(text).toContain('your details are already filled in):\nhttps://trendstarz.in/register-brand?shortlist=x');
    expect(text).toContain('You pay only for creators who accept.');
  });

  it('works without a signup link or rate', () => {
    const text = shortlistMessage(request, [{ ...creator, rate: null }, creator], 'https://trendstarz.in', '');
    expect(text).toContain('Here are 2 creators');
    expect(text).toContain('create your free brand account on trendstarz.in');
    expect(signupMessage(request, 'L')).toContain('Hi Asha, here is your TrendStarZ brand signup link');
  });
});
