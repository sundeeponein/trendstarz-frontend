import { fileShareChoices, isFileShareLink, isFileSharePlatform } from './file-share-video.util';

describe('Video (File Share) helpers', () => {
  it('recognises the platform', () => {
    expect(isFileSharePlatform('Video (File Share)')).toBeTrue();
    expect(isFileSharePlatform('file_share')).toBeTrue();
    expect(isFileSharePlatform('Instagram')).toBeFalse();
  });

  it('offers Raw + Edited (summed) only when the host enabled both', () => {
    const both = fileShareChoices({
      contentTypes: [
        { name: 'Raw video', enabled: true, price: 1500, aspectRatio: '9:16' },
        { name: 'Edited video', enabled: true, price: 4000, aspectRatio: 'both' },
      ],
    });
    expect(both.map((c) => c.contentType)).toEqual(['Raw video', 'Edited video', 'Raw + Edited video']);
    expect(both[2].price).toBe(5500);

    const rawOnly = fileShareChoices({
      contentTypes: [
        { name: 'Raw video', enabled: true, price: 1500, aspectRatio: '16:9' },
        { name: 'Edited video', enabled: false, price: 0 },
      ],
    });
    expect(rawOnly.map((c) => c.contentType)).toEqual(['Raw video']);
  });

  it('accepts file-sharing links only', () => {
    expect(isFileShareLink('https://drive.google.com/drive/folders/abc')).toBeTrue();
    expect(isFileShareLink('https://www.instagram.com/reel/abc')).toBeFalse();
    expect(isFileShareLink('drive.google.com/abc')).toBeTrue();
    expect(isFileShareLink('not a link')).toBeFalse();
  });
});
