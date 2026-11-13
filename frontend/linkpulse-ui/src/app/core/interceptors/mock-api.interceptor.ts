import { HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { of, delay } from 'rxjs';
import { MOCK_HANDLERS } from './mock-handlers';

export const mockApiInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next) => {
  const handler = MOCK_HANDLERS.find(h =>
    h.method === req.method && matchPath(h.pattern, req.url),
  );

  if (handler) {
    const params = extractParams(handler.pattern, req.url);
    return of(new HttpResponse({ status: 200, body: handler.respond(params, req) }))
      .pipe(delay(300));
  }

  return next(req);
};

function matchPath(pattern: string, url: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '(\\?.*)?$',
  );
  return regex.test(url.split('?')[0]);
}

function extractParams(pattern: string, url: string): Record<string, string> {
  const keys = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1]);
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
  const match = url.split('?')[0].match(regex);
  if (!match) return {};
  return Object.fromEntries(keys.map((k, i) => [k, match[i + 1]]));
}
