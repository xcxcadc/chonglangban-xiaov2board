import { describe, expect, it } from 'vitest';
import { normalizeRequestError } from './errors';

describe('normalizeRequestError', () => {
  it('keeps the backend message when one is provided', () => {
    const error = {
      response: {
        data: { message: 'Token expired' }
      }
    };

    expect(normalizeRequestError(error).response.message).toBe('Token expired');
  });

  it('provides a stable message for HTTP status errors', () => {
    const error = {
      response: {
        status: 401,
        data: {}
      }
    };

    expect(normalizeRequestError(error).response.message).toBe('未授权，请重新登录');
  });

  it('normalizes network timeout errors', () => {
    const error = { message: 'timeout of 20000ms exceeded' };

    expect(normalizeRequestError(error).message).toBe('请求超时');
  });
});
