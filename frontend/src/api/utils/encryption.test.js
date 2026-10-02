import { beforeEach, describe, expect, it } from 'vitest';
import { getProtectedSubscriptionUrl, randomIv } from './encryption';

describe('middleware encryption helpers', () => {
  beforeEach(() => {
    globalThis.window = {
      location: { origin: 'https://panel.example.com' },
      CHONGLANGBAN_CONFIG: {
        API_MIDDLEWARE_PROTOCOL: 'aead',
        API_MIDDLEWARE_URL: 'https://middleware.example.com',
        API_MIDDLEWARE_PATH: '/clb/clb',
        API_MIDDLEWARE_AEAD_KEY: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
      }
    };
    localStorage.clear();
  });

  it('does not encrypt an already protected v2 subscription URL again', async () => {
    const url = 'https://middleware.example.com/clb/clb/v2.already-encrypted';
    await expect(getProtectedSubscriptionUrl(url)).resolves.toBe(url);
  });

  it('creates a valid legacy IV and reuses it', () => {
    const first = randomIv();
    expect(first).toMatch(/^[0-9a-f]{16}$/i);
    expect(randomIv()).toBe(first);
  });
});
