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

export interface UpstreamFailureError extends BaseApplicationError {
  code: 'UPSTREAM_FAILURE';
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
