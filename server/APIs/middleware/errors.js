export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireThat(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  if (error.code === '23505') {
    status = 409;
    message = 'An account or record with those details already exists.';
  } else if (error.code === '23503') {
    status = 409;
    message = 'This record is still associated with other records.';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large.';
  }
  if (status >= 500) {
    console.error('API request failed:', error.code || error.name);
    message =
      status === 503
        ? error instanceof HttpError
          ? error.message
          : 'Service temporarily unavailable.'
        : 'Internal server error.';
  }
  res.status(status).json({ message });
}
