import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { mockApiInterceptor } from './core/interceptors/mock-api.interceptor';

const httpInterceptors: HttpInterceptorFn[] = environment.useMockApi
  ? [mockApiInterceptor]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptors(httpInterceptors),
    ),
  ],
};