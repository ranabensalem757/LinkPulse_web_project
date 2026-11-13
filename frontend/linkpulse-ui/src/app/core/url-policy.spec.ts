import { validatePublicUrl } from './url-policy';

describe('validatePublicUrl', () => {
  it('accepts a complete public HTTP(S) URL', () => {
    expect(validatePublicUrl('https://example.com/status').ok).toBe(true);
  });

  it('rejects unsupported schemes and embedded credentials', () => {
    expect(validatePublicUrl('ftp://example.com').ok).toBe(false);
    expect(validatePublicUrl('https://user:pass@example.com').ok).toBe(false);
  });

  it('rejects local hosts and nonstandard ports', () => {
    expect(validatePublicUrl('http://localhost').ok).toBe(false);
    expect(validatePublicUrl('https://example.com:8443').ok).toBe(false);
  });
});
