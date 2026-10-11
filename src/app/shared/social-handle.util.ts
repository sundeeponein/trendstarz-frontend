export function normalizeSocialHandle(value: unknown, platformName = ''): string {
  let text = String(value || '').trim();
  if (!text) return '';

  text = text.replace(/^@+/, '');

  const looksLikeUrl = /^https?:\/\//i.test(text) || /^www\./i.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(text);
  if (looksLikeUrl) {
    try {
      const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      const url = new URL(withProtocol);
      if (url.hostname.includes('.')) {
        text = `${url.pathname}${url.search}`;
      }
    } catch {
      // Not a URL; continue with direct username cleanup.
    }
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

export function socialHandleAllowedPattern(platformName = ''): RegExp {
  const platform = String(platformName || '').toLowerCase();
  if (platform.includes('youtube')) return /^[a-zA-Z0-9._@-]+$/;
  if (platform.includes('linkedin')) return /^[a-zA-Z0-9-]+$/;
  if (platform.includes('twitter') || platform === 'x') return /^[a-zA-Z0-9_]+$/;
  if (platform.includes('instagram') || platform.includes('facebook')) return /^[a-zA-Z0-9._]+$/;
  return /^[a-zA-Z0-9._-]+$/;
}

export function socialHandleAllowedCharacters(platformName = ''): string {
  const platform = String(platformName || '').toLowerCase();
  if (platform.includes('youtube')) return 'letters, numbers, dot (.), underscore (_), hyphen (-), and @';
  if (platform.includes('linkedin')) return 'letters, numbers, and hyphen (-)';
  if (platform.includes('twitter') || platform === 'x') return 'letters, numbers, and underscore (_)';
  if (platform.includes('instagram') || platform.includes('facebook')) return 'letters, numbers, dot (.), and underscore (_)';
  return 'letters, numbers, dot (.), underscore (_), and hyphen (-)';
}

export function validateSocialHandle(value: unknown, platformName = ''): string | null {
  const clean = normalizeSocialHandle(value, platformName);
  if (!clean) return 'Username is required.';
  if (!socialHandleAllowedPattern(platformName).test(clean)) {
    return `${platformName || 'Social'} username can only contain ${socialHandleAllowedCharacters(platformName)}.`;
  }
  return null;
}

export function buildSocialProfileUrl(platformName: string, handle: unknown): string {
  const clean = normalizeSocialHandle(handle, platformName);
  if (!clean) return '';
  const platform = String(platformName || '').toLowerCase();
  if (platform.includes('instagram')) return `https://instagram.com/${clean}`;
  if (platform.includes('youtube')) return `https://www.youtube.com/@${clean}`;
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
