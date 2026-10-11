export type ApplicationErrorCode =
  | 'INVALID_REQUEST'
  | 'URL_NOT_PUBLIC'
  | 'REDIRECT_NOT_ALLOWED'
  | 'UPSTREAM_FAILURE'
  | 'INTERNAL_ERROR';

interface BaseApplicationError {
  message: string;
}

export interface InvalidRequestError extends BaseApplicationError {
  code: 'INVALID_REQUEST';
}

export interface UrlNotPublicError extends BaseApplicationError {
  code: 'URL_NOT_PUBLIC';
}

export interface RedirectNotAllowedError extends BaseApplicationError {
  code: 'REDIRECT_NOT_ALLOWED';
}

export class MainDocumentRedirectError extends Error implements RedirectNotAllowedError {
  readonly code = 'REDIRECT_NOT_ALLOWED' as const;

  constructor() {
    super('The main document navigation must not redirect.');
    this.name = 'MainDocumentRedirectError';
  }
}

export interface UpstreamFailureError extends BaseApplicationError {
  code: 'UPSTREAM_FAILURE';
}

export class UpstreamFailureError extends Error {
  readonly code = 'UPSTREAM_FAILURE' as const;

  constructor() {
    super('The upstream site could not be processed.');
    this.name = 'UpstreamFailureError';
  }
}

export interface InternalError extends BaseApplicationError {
  code: 'INTERNAL_ERROR';
}

export type ApplicationError =
  | InvalidRequestError
  | UrlNotPublicError
  | RedirectNotAllowedError
  | UpstreamFailureError
  | InternalError;
