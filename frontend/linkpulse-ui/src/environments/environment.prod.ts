/**
 * Production configuration.
 *
 * Every service call goes to the real backend. Adjust `apiBaseUrl` if the API is
 * served from another origin, or configure a reverse proxy in front of the SPA.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
};