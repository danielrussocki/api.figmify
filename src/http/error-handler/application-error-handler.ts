import type { FastifyInstance } from 'fastify';

import type { ApplicationError, ApplicationErrorCode } from '../../contracts/errors/application-error.js';

const statusByCode: Record<ApplicationErrorCode, number> = {
  INVALID_REQUEST: 400,
  URL_NOT_PUBLIC: 422,
  REDIRECT_NOT_ALLOWED: 502,
  UPSTREAM_FAILURE: 502,
  INTERNAL_ERROR: 500,
};

const internalErrorResponse = {
  code: 'INTERNAL_ERROR',
  message: 'An internal error occurred.',
} as const;

function isApplicationError(error: unknown): error is ApplicationError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { code, message } = error as Partial<ApplicationError>;

  return (
    typeof message === 'string' &&
    typeof code === 'string' &&
    Object.hasOwn(statusByCode, code)
  );
}

export function registerApplicationErrorHandler(application: FastifyInstance): void {
  application.setErrorHandler((error, _request, reply) => {
    if (isApplicationError(error)) {
      return reply.status(statusByCode[error.code]).send({
        code: error.code,
        message: error.message,
      });
    }

    return reply.status(500).send(internalErrorResponse);
  });
}
