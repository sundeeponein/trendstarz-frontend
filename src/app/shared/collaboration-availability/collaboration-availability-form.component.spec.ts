import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CollaborationAvailabilityFormComponent } from './collaboration-availability-form.component';
import { isBelowMinimumRate } from '../rates.util';
import { busyUntilText, notAvailableUntil } from '../availability.util';

describe('CollaborationAvailabilityFormComponent — explicit availability (3D-1d)', () => {
  let fixture: ComponentFixture<CollaborationAvailabilityFormComponent>;
  let component: CollaborationAvailabilityFormComponent;
  let form: FormGroup;

  const build = (value: Record<string, unknown>) => {
    form = new FormBuilder().group({
      enabled: [false],
      state: [null],
      notAvailableUntil: [null],
      availableFor: [[]],
      preference: [''],
      openToTravel: [false],
    });
    form.patchValue(value);
    fixture = TestBed.createComponent(CollaborationAvailabilityFormComponent);
    component = fixture.componentInstance;
    component.form = form;
    component.role = 'photographer';
    fixture.detectChanges();
  };
  const radios = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  const text = () => (fixture.nativeElement as HTMLElement).innerText;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CollaborationAvailabilityFormComponent] });
  });

  it('offers two choices and asks the creator to choose when nothing is set', () => {
    build({});
    expect(radios().length).toBe(2);
    expect(radios().some((r) => r.checked)).toBeFalse();
    expect(text()).toContain('Not set yet');
  });

  it('a profile switched on before 3D-1d shows as available (not "not set")', () => {
    build({ enabled: true });
    expect(component.availabilityChoice).toBe('available');
    expect(radios()[0].checked).toBeTrue();
    expect(text()).not.toContain('Not set yet');
  });

  it('choosing "Not available right now" stores the state and switches enabled off', () => {
    build({ enabled: true, state: 'available' });
    radios()[1].click();
    fixture.detectChanges();
    expect(form.value).toEqual(
      jasmine.objectContaining({ state: 'not_available', enabled: false }),
    );
    expect(form.dirty).toBeTrue();
  });

  it('choosing available stores the state and switches enabled on', () => {
    build({});
    radios()[0].click();
    fixture.detectChanges();
    expect(form.value).toEqual(jasmine.objectContaining({ state: 'available', enabled: true }));
  });

  it('"not available" always has an end: 2 weeks by default, or 1 week / 1 month', () => {
    build({ enabled: true, state: 'available' });
    radios()[1].click();
    fixture.detectChanges();
    const daysAhead = () =>
      Math.round((new Date(form.value.notAvailableUntil).getTime() - Date.now()) / 86400000);
    expect(daysAhead()).toBe(14);
    expect(text()).toContain('Not available until');
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.ca-duration button'),
    );
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['1 week', '2 weeks', '1 month']);
    buttons[2].click();
    fixture.detectChanges();
    expect(daysAhead()).toBe(30);
    buttons[0].click();
    expect(daysAhead()).toBe(7);
  });

  it('switching back to available clears the end date', () => {
    build({ state: 'not_available', notAvailableUntil: new Date(Date.now() + 5 * 86400000).toISOString() });
    radios()[0].click();
    expect(form.value).toEqual(jasmine.objectContaining({ state: 'available', notAvailableUntil: null }));
  });

  it('a read-only form cannot be changed', () => {
    build({ enabled: true, state: 'available' });
    component.readonly = true;
    component.chooseAvailability('not_available');
    expect(form.value.state).toBe('available');
  });
});

describe('isBelowMinimumRate (3D-1d)', () => {
  it('flags 1–49; empty, 0 and ₹50+ are fine', () => {
    expect([1, 49, '20'].map(isBelowMinimumRate)).toEqual([true, true, true]);
    expect([0, '', null, 50, 5000].map(isBelowMinimumRate)).toEqual([false, false, false, false, false]);
  });
});

describe('availability.util (Option B)', () => {
  const NOW = new Date('2026-10-09T06:00:00.000Z');
  const day = (n: number) => new Date(NOW.getTime() + n * 86400000);

  it('only a running "not available" period has an end date', () => {
    expect(notAvailableUntil({ state: 'not_available', notAvailableUntil: day(5) }, NOW)).toEqual(day(5));
    expect(notAvailableUntil({ state: 'not_available', notAvailableUntil: day(-1) }, NOW)).toBeNull();
    expect(notAvailableUntil({ state: 'available', notAvailableUntil: day(5) }, NOW)).toBeNull();
    // Set before durations existed: ends 14 days after it was chosen.
    expect(notAvailableUntil({ state: 'not_available', stateUpdatedAt: day(-3) }, NOW)).toEqual(day(11));
  });

  it('hosts see "May be busy until …" — never for available or never-set creators', () => {
    const creator = (collaborationAvailability: any) => ({ collaborationAvailability });
    expect(busyUntilText(creator({ state: 'not_available', notAvailableUntil: day(14) }), NOW)).toBe(
      'May be busy until 23 Oct',
    );
    expect(busyUntilText(creator({ state: 'available' }), NOW)).toBe('');
    expect(busyUntilText(creator({ enabled: false }), NOW)).toBe('');
    expect(busyUntilText({}, NOW)).toBe('');
  });
});
