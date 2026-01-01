import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'resolvePlatform',
  standalone: true
})
export class ResolvePlatformPipe implements PipeTransform {
  transform(sm: any): string {
    if (!sm || !sm.platform) return '';
    const p = sm.platform.toLowerCase();
    if (p.includes('insta')) return 'instagram';
    if (p.includes('face')) return 'facebook';
    if (p.includes('youtube')) return 'youtube';
    return p;
  }
}
