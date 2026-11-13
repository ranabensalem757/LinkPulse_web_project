/**
 * Central runtime configuration.
 *
 * `apiBaseUrl` is the single source of truth for every HTTP call made by the
 * Angular services. Point it at the FastAPI server (for example
 * `http://127.0.0.1:8000/api`) once the backend endpoints are available; the
 * in-browser mock interceptor answers the same paths until then.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
  useMockApi: true,
};