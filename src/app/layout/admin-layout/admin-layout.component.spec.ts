import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ConfigService } from '../../shared/config.service';
import { SessionService } from '../../core/session.service';
import { AdminLayoutComponent } from './admin-layout.component';

describe('AdminLayoutComponent — grouped admin menu', () => {
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let component: AdminLayoutComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const topLevel = () =>
    Array.from(el().querySelectorAll('.navbar-tabs > .nav-dropdown > .nav-tab, .navbar-tabs > a.nav-tab')).map(
      (n) => n.textContent!.replace(/\s+/g, ' ').trim(),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: ConfigService, useValue: { adminCountOpenDisputes: () => of({ count: 0 }) } },
        { provide: SessionService, useValue: { getToken: () => null, clearSession: () => {} } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the grouped menu in order', () => {
    expect(topLevel()).toEqual(['Users', 'Review', 'Payments', 'Disputes', 'Link Analytics', 'Reviews']);
  });

  it('Users opens Users list, Deleted users, Matching Evidence and Tier Review; Review opens Campaigns and Collaborations', () => {
    const items = (label: string) => {
      const btn = Array.from(el().querySelectorAll<HTMLButtonElement>('.nav-dropdown-toggle')).find(
        (b) => b.textContent!.trim() === label,
      )!;
      btn.click(); // a real click, like the admin
      fixture.detectChanges();
      return Array.from(el().querySelectorAll('.nav-submenu a')).map((a) => [
        a.textContent!.trim(),
        a.getAttribute('href'),
      ]);
    };
    expect(items('Users')).toEqual([
      ['Users list', '/admin/admin-user-table'],
      ['Deleted users', '/admin/deleted-users'],
      ['Matching Evidence', '/admin/matching-evidence'],
      ['Tier Review', '/admin/tier-review'],
    ]);
    expect(items('Review')).toEqual([
      ['Campaigns', '/admin/campaign-review'],
      ['Collaborations', '/admin/collaboration-review'],
    ]);
  });

  it('only one group is open at a time, and a group is highlighted while one of its pages is open', () => {
    component.toggleNavGroup('users', new Event('click'));
    component.toggleNavGroup('review', new Event('click'));
    expect(component.openNavGroup).toBe('review');
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/admin/tier-review?reason=observed_mismatch');
    const [users, review] = component.navGroups;
    expect(component.isNavGroupActive(users)).toBeTrue();
    expect(component.isNavGroupActive(review)).toBeFalse();
  });
});
