/**
 * Central runtime configuration.
 *
 * `apiBaseUrl` is the single source of truth for every HTTP call made by the
 * Angular services. Point it at the FastAPI server, for example
 * `http://127.0.0.1:3000/api`, once the backend is available.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};