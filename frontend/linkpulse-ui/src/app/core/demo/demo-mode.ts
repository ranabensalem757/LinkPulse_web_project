import { InjectionToken } from '@angular/core';

export const DEMO_MODE = new InjectionToken<boolean>('DEMO_MODE', {
  providedIn: 'root',
  factory: () => false,
});
