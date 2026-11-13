import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { StatusBadgeComponent, StatusType } from './status-badge';

@Component({
  imports: [StatusBadgeComponent],
  template: `<app-status-badge [status]="status" />`,
})
class HostComponent {
  status: StatusType = 'online';
}

describe('StatusBadgeComponent', () => {
  function setup(status: StatusType) {
    const fixture = TestBed.configureTestingModule({
      imports: [HostComponent],
    }).createComponent(HostComponent);
    fixture.componentInstance.status = status;
    fixture.detectChanges();
    return fixture;
  }

  it('displays "En ligne" for online status', () => {
    const f = setup('online');
    expect(f.nativeElement.textContent).toContain('En ligne');
  });

  it('displays "Hors ligne" for offline status', () => {
    const f = setup('offline');
    expect(f.nativeElement.textContent).toContain('Hors ligne');
  });

  it('displays "Critique" for critical status', () => {
    const f = setup('critical');
    expect(f.nativeElement.textContent).toContain('Critique');
  });

  it('displays "En veille" for paused status', () => {
    const f = setup('paused');
    expect(f.nativeElement.textContent).toContain('En veille');
  });

  it('displays "Résolu" for resolved status', () => {
    const f = setup('resolved');
    expect(f.nativeElement.textContent).toContain('Résolu');
  });

  it('applies the correct CSS modifier class', () => {
    const f = setup('offline');
    const badge = f.nativeElement.querySelector('.badge');
    expect(badge.classList).toContain('badge--offline');
  });

  it('has aria-label containing the status label', () => {
    const f = setup('online');
    const badge = f.nativeElement.querySelector('.badge');
    expect(badge.getAttribute('aria-label')).toContain('En ligne');
  });

  it('has role="status" for screen readers', () => {
    const f = setup('online');
    const badge = f.nativeElement.querySelector('.badge');
    expect(badge.getAttribute('role')).toBe('status');
  });
});
