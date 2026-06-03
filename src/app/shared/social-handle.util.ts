export function normalizeSocialHandle(value: unknown, platformName = ''): string {
  let text = String(value || '').trim();
  if (!text) return '';

  text = text.replace(/^@+/, '');

  try {
    const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    const url = new URL(withProtocol);
    if (url.hostname.includes('.')) {
      text = `${url.pathname}${url.search}`;
    }
  } catch {
    // Not a URL; continue with direct username cleanup.
  }

  text = text.split('?')[0].split('#')[0];
  text = text.replace(/^\/+|\/+$/g, '');

  const lowerPlatform = String(platformName || '').toLowerCase();
  if (lowerPlatform.includes('youtube')) {
    text = text.replace(/^channel\//i, '').replace(/^c\//i, '').replace(/^user\//i, '');
  }
  if (lowerPlatform.includes('linkedin')) {
    text = text.replace(/^in\//i, '').replace(/^company\//i, '');
  }

  return text.replace(/@/g, '').replace(/\s+/g, '');
}

export function buildSocialProfileUrl(platformName: string, handle: unknown): string {
  const clean = normalizeSocialHandle(handle, platformName);
  if (!clean) return '';
  const platform = String(platformName || '').toLowerCase();
  if (platform.includes('instagram')) return `https://instagram.com/${clean}`;
  if (platform.includes('youtube')) return `https://youtube.com/@${clean}`;
  if (platform.includes('twitter') || platform === 'x') return `https://x.com/${clean}`;
  if (platform.includes('facebook')) return `https://facebook.com/${clean}`;
  if (platform.includes('tiktok')) return `https://tiktok.com/@${clean}`;
  if (platform.includes('linkedin')) return `https://linkedin.com/in/${clean}`;
  return '';
}

export function socialHandlePlaceholder(platformName: string): string {
  const platform = String(platformName || '') .toLowerCase(); 
    if (platform.includes('instagram')) { return 'yourusername';}
    if (platform.includes('youtube')) {return 'yourchannel';}
    if (platform.includes('facebook')) {return 'yourpage';}
    if (platform.includes('linkedin')) {return 'company-name';}
    return 'yourusername';
}

export function socialHandleExample(platformName: string): string {
  const platform = String(platformName || '').toLowerCase();
  if (platform.includes('instagram')) return 'yourusername';
  if (platform.includes('youtube')) return 'yourusername';
  if (platform.includes('facebook')) return 'yourusername';
  if (platform.includes('tiktok')) return 'yourusername';
  if (platform.includes('linkedin')) return 'yourusername';
  return 'yourusername';
}
