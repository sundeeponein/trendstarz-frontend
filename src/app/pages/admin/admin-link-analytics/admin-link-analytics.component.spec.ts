import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TrackingLinksApiService } from '../../../shared/tracking-links/tracking-links-api.service';
import { AdminLinkAnalyticsComponent } from './admin-link-analytics.component';

describe('AdminLinkAnalyticsComponent', () => {
  let fixture: ComponentFixture<AdminLinkAnalyticsComponent>;
  let component: AdminLinkAnalyticsComponent;
  let api: jasmine.SpyObj<TrackingLinksApiService>;

  const link = (i: number) => ({
    code: `C${i}`,
    campaignId: 'camp15',
    campaignNumber: 15,
    hostName: 'Trendstarz',
    hostType: 'brand',
    recipientType: 'influencer',
    platform: 'Instagram',
    contentType: 'Reel',
    clickCount: 100 - i,
    uniqueClicks: 90 - i,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  const analytics = (rows: number) => ({
    overview: { totalLinks: rows, totalClicks: 0, totalUniqueClicks: 0 },
    perCampaign: [
      { campaignId: 'camp15', campaignNumber: 15, campaignTitle: 'Summer', links: rows, clicks: 0 },
      { campaignId: 'camp13', campaignNumber: 13, campaignTitle: 'Promo', links: 0, clicks: 0 },
    ],
    topPerformers: Array.from({ length: rows }, (_, i) => link(i)),
    topPerformersTotal: rows,
    zeroActivity: [],
    zeroActivityTotal: 0,
    referralLinks: [],
  });

  beforeEach(async () => {
    api = jasmine.createSpyObj('api', ['getAdminAnalytics']);
    api.getAdminAnalytics.and.returnValue(of(analytics(30) as any));
    await TestBed.configureTestingModule({
      imports: [AdminLinkAnalyticsComponent],
      providers: [{ provide: TrackingLinksApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminLinkAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const text = () => (fixture.nativeElement as HTMLElement).innerText.replace(/\s+/g, ' ');
  const rowCodes = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr td:first-child')).map(
      (td) => td.textContent!.trim(),
    );

  it('fetches enough rows to page through, not just the first 25', () => {
    expect(api.getAdminAnalytics.calls.mostRecent().args[0]).toEqual({ limit: 1000 });
  });

  it('pages the top performers (25 per page) and shows the full count on the tab', () => {
    expect(rowCodes().length).toBe(25);
    expect(rowCodes()[0]).toBe('C0');
    expect(fixture.nativeElement.querySelector('app-paginator')).not.toBeNull();
    component.setPage('top', 2);
    fixture.detectChanges();
    expect(rowCodes()).toEqual(['C25', 'C26', 'C27', 'C28', 'C29']);
    expect(text()).toContain('Top performers 30');
  });

  it('no paginator when everything fits on one page', () => {
    api.getAdminAnalytics.and.returnValue(of(analytics(5) as any));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-paginator')).toBeNull();
  });

  it('typing a campaign that has no tracked links does not pretend to filter (CMP-12)', () => {
    component.openCampaignDropdown();
    component.campaignSearchTerm = 'CMP-12';
    expect(component.filteredCampaignOptions).toEqual([]);
    component.closeCampaignDropdown();
    fixture.detectChanges();
    expect(component.campaignSearchTerm).toBe(''); // box goes back to "All campaigns"
    expect(text()).toContain('Showing: All campaigns');
    expect(text()).toContain('No campaign with tracked links matches "CMP-12"');
    expect(api.getAdminAnalytics).toHaveBeenCalledTimes(1); // no filtered reload
  });

  it('Enter applies the first matching campaign and filters the data', () => {
    component.campaignSearchTerm = 'CMP-15';
    component.selectFirstMatch();
    fixture.detectChanges();
    expect(api.getAdminAnalytics.calls.mostRecent().args[0]).toEqual({
      limit: 1000,
      campaignId: 'camp15',
    });
    expect(text()).toContain('Showing: CMP-15 — Summer');
  });
});
