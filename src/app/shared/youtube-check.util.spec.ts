import { YoutubeCheck, youtubeCheckFor } from './youtube-check.util';

describe('youtubeCheckFor', () => {
  const check = { socialAccountId: 'a1', platform: 'YouTube', subscribers: 815 } as YoutubeCheck;
  it('matches only the YouTube platform entry', () => {
    expect(youtubeCheckFor({ name: 'YouTube' }, [check])).toBe(check);
    expect(youtubeCheckFor({ platform: 'youtube' }, [check])).toBe(check);
    expect(youtubeCheckFor({ name: 'Instagram' }, [check])).toBeNull();
    expect(youtubeCheckFor({ name: 'YouTube' }, [])).toBeNull();
  });
});
