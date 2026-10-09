import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CollaborationAvailabilityFormComponent } from './collaboration-availability-form.component';
import { isBelowMinimumRate } from '../rates.util';

describe('CollaborationAvailabilityFormComponent — explicit availability (3D-1d)', () => {
  let fixture: ComponentFixture<CollaborationAvailabilityFormComponent>;
  let component: CollaborationAvailabilityFormComponent;
  let form: FormGroup;

  const build = (value: Record<string, unknown>) => {
    form = new FormBuilder().group({
      enabled: [false],
      state: [null],
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
