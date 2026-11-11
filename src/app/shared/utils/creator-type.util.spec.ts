import { ALL_PROFESSIONAL_CREATORS, matchesCreatorType } from './creator-type.util';

describe('matchesCreatorType (Search creator type filter)', () => {
  const ugc = { professionalStatus: true, creatorTypes: ['UGC Creator', 'Model'] };
  const switchedOff = { professionalStatus: false, creatorTypes: ['UGC Creator'] };
  const noTypes = { professionalStatus: true, creatorTypes: [] };

  it('any creator: everyone', () => {
    expect([ugc, switchedOff, noTypes, {}].every((c) => matchesCreatorType(c, ''))).toBeTrue();
  });

  it('a type: professional creators with it, any case', () => {
    expect(matchesCreatorType(ugc, 'ugc creator')).toBeTrue();
    expect(matchesCreatorType(ugc, 'Actor')).toBeFalse();
    // Types left behind after switching Professional Status off don't count (cards hide them).
    expect(matchesCreatorType(switchedOff, 'UGC Creator')).toBeFalse();
  });

  it('all professional creators: professional status on, with or without types', () => {
    expect(matchesCreatorType(ugc, ALL_PROFESSIONAL_CREATORS)).toBeTrue();
    expect(matchesCreatorType(noTypes, ALL_PROFESSIONAL_CREATORS)).toBeTrue();
    expect(matchesCreatorType(switchedOff, ALL_PROFESSIONAL_CREATORS)).toBeFalse();
  });
});
