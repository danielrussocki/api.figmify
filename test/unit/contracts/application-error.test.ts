import { expectTypeOf, test } from 'vitest';

import type {
  ApplicationError,
  ApplicationErrorCode,
  InternalError,
  InvalidRequestError,
  RedirectNotAllowedError,
  UpstreamFailureError,
  UrlNotPublicError,
} from '../../../src/contracts/errors/application-error.js';

test('models the normalized application error categories', () => {
  const invalidRequest: InvalidRequestError = {
    code: 'INVALID_REQUEST',
    message: 'The request is invalid.',
  };
  const urlNotPublic: UrlNotPublicError = {
    code: 'URL_NOT_PUBLIC',
    message: 'The URL must resolve to a public address.',
  };
  const redirectNotAllowed: RedirectNotAllowedError = {
    code: 'REDIRECT_NOT_ALLOWED',
    message: 'Main document redirects are not allowed.',
  };
  const upstreamFailure: UpstreamFailureError = {
    code: 'UPSTREAM_FAILURE',
    message: 'The upstream site could not be processed.',
  };
  const internalError: InternalError = {
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred.',
  };

  const errors: ApplicationError[] = [
    invalidRequest,
    urlNotPublic,
    redirectNotAllowed,
    upstreamFailure,
    internalError,
  ];

  expectTypeOf<ApplicationErrorCode>().toEqualTypeOf<
    | 'INVALID_REQUEST'
    | 'URL_NOT_PUBLIC'
    | 'REDIRECT_NOT_ALLOWED'
    | 'UPSTREAM_FAILURE'
    | 'INTERNAL_ERROR'
  >();
  expectTypeOf(errors).toEqualTypeOf<ApplicationError[]>();
  expectTypeOf(invalidRequest.code).toEqualTypeOf<'INVALID_REQUEST'>();
  expectTypeOf(urlNotPublic.code).toEqualTypeOf<'URL_NOT_PUBLIC'>();
  expectTypeOf(redirectNotAllowed.code).toEqualTypeOf<'REDIRECT_NOT_ALLOWED'>();
  expectTypeOf(upstreamFailure.code).toEqualTypeOf<'UPSTREAM_FAILURE'>();
  expectTypeOf(internalError.code).toEqualTypeOf<'INTERNAL_ERROR'>();
});
