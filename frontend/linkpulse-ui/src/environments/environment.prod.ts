/**
 * Production configuration.
 *
 * The mock interceptor is disabled here: every service call goes to the real
 * FastAPI backend. Adjust `apiBaseUrl` if the API is served from another origin.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
  useMockApi: false,
};