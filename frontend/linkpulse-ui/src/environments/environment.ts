/**
 * Central runtime configuration.
 *
 * `apiBaseUrl` is the single source of truth for every HTTP call made by the
 * Angular services. En développement, `/api` est redirigé vers le backend
 * Express (http://127.0.0.1:3000) par `proxy.conf.json`.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};