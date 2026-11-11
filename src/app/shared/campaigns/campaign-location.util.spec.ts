import { campaignTargetDistrictOf, campaignTargetLocationPayload } from './campaign-location.util';

describe('campaign target location (Stage 3B-1 T1)', () => {
  it('a newly selected district is saved to targetDistrict (targetCities mirrors it for legacy readers)', () => {
    expect(campaignTargetLocationPayload('Telangana', 'Hyderabad')).toEqual({
      targetState: 'Telangana',
      targetDistrict: 'Hyderabad',
      targetCities: ['Hyderabad'],
    });
  });

  it('no district → empty district (clears it on edit)', () => {
    expect(campaignTargetLocationPayload('Telangana', '')).toEqual({
      targetState: 'Telangana',
      targetDistrict: '',
      targetCities: [],
    });
  });

  it('a district is never kept without a state', () => {
    expect(campaignTargetLocationPayload('', 'Hyderabad')).toEqual({ targetState: '', targetDistrict: '', targetCities: [] });
  });

  it('editing reads targetDistrict first, then the legacy targetCities[0]', () => {
    expect(campaignTargetDistrictOf({ targetDistrict: 'Warangal', targetCities: ['Hyderabad'] })).toBe('Warangal');
    expect(campaignTargetDistrictOf({ targetCities: ['Hyderabad'] })).toBe('Hyderabad');
    expect(campaignTargetDistrictOf({})).toBe('');
  });
});
