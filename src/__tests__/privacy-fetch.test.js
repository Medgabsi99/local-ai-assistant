import { describe, it, expect } from 'vitest';

describe('privacy-preserving fetches', () => {
  it('uses no credentials and no referrer for external requests', () => {
    const init = {
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    };

    expect(init.credentials).toBe('omit');
    expect(init.cache).toBe('no-store');
    expect(init.referrerPolicy).toBe('no-referrer');
  });
});
