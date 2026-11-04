import { TestBed } from '@angular/core/testing';
import { AdminSocialNoticeComponent } from './admin-social-notice.component';

describe('AdminSocialNoticeComponent (influencer + photographer dashboards)', () => {
  const render = (notifications: any[]) => {
    TestBed.configureTestingModule({ imports: [AdminSocialNoticeComponent] });
    const fixture = TestBed.createComponent(AdminSocialNoticeComponent);
    fixture.componentInstance.notifications = notifications;
    fixture.detectChanges();
    return fixture;
  };
  const autoChange = {
    platform: 'youtube',
    oldHandle: 'chan',
    newHandle: 'chan',
    oldTier: 'Starter',
    newTier: 'Nano',
    changedByName: 'Auto (YouTube observation)',
    changedAt: '2026-10-10T21:30:00.000Z',
  };

  it('shows the tier change with its range, who made it and when, and the rates reminder', () => {
    const el = render([autoChange]).nativeElement as HTMLElement;
    const text = el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Your social media details were updated');
    expect(text).not.toContain('by Admin</strong>');
    expect(text).toContain('Nano (101–1,000 followers)');
    expect(text).toContain('Starter');
    expect(text).toContain('by Auto (YouTube observation)');
    expect(text).toContain('review your rates');
  });

  it('Confirm / Cancel / dismiss / Edit are passed to the dashboard', () => {
    const fixture = render([autoChange]);
    const answers: any[] = [];
    let edits = 0;
    fixture.componentInstance.respond.subscribe((a) => answers.push(a));
    fixture.componentInstance.edit.subscribe(() => edits++);
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.admin-social-action--confirm') as HTMLElement).click();
    (el.querySelector('.admin-social-action--cancel') as HTMLElement).click();
    (el.querySelector('.admin-social-notif-dismiss') as HTMLElement).click();
    (el.querySelector('.admin-social-action--edit') as HTMLElement).click();
    expect(answers).toEqual(['confirmed', 'cancelled', undefined]);
    expect(edits).toBe(1);
  });

  it('nothing without notices', () => {
    expect((render([]).nativeElement as HTMLElement).querySelector('.admin-social-notif-banner')).toBeNull();
  });
});
