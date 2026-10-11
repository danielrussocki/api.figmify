import { describe, expect, test } from 'vitest';

import {
  PublicUrlPolicyError,
  enforcePublicUrlPolicy,
} from '../../../../src/security/url-policy/public-url-policy.js';

function expectUrlNotPublic(url: string): void {
  expect(() => enforcePublicUrlPolicy(new URL(url), 'production')).toThrow(
    PublicUrlPolicyError,
  );

  try {
    enforcePublicUrlPolicy(new URL(url), 'production');
  } catch (error) {
    expect(error).toMatchObject({ code: 'URL_NOT_PUBLIC' });
  }
}

describe('enforcePublicUrlPolicy', () => {
  test('allows a public hostname in production', () => {
    expect(() =>
      enforcePublicUrlPolicy(new URL('https://example.com/path'), 'production'),
    ).not.toThrow();
  });

  test.each([
    'http://localhost',
    'http://api.localhost',
    'http://127.0.0.1',
    'http://10.0.0.1',
    'http://169.254.1.1',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://100.64.0.1',
    'http://0.0.0.0',
    'http://224.0.0.1',
    'http://240.0.0.1',
    'http://192.0.2.1',
    'http://198.51.100.1',
    'http://203.0.113.1',
    'http://[::1]',
    'http://[fc00::1]',
    'http://[fe80::1]',
    'http://[ff02::1]',
    'http://[::]',
    'http://[2001:db8::1]',
    'http://[::ffff:192.168.1.1]',
  ])('rejects a non-public production URL: %s', expectUrlNotPublic);
});
