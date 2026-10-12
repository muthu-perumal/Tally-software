/**
 * Standard HTTP response helper for Netlify Functions
 */

export function successResponse(data, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...headers,
    },
    body: JSON.stringify({
      success: true,
      data,
    }),
  };
}

export function errorResponse(message, errorCode = 'INTERNAL_ERROR', statusCode = 500, details = null) {
  // Sanitize message: never leak DB connection strings, passwords, or secrets
  const sanitizedMessage = typeof message === 'string'
    ? message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URI_REDACTED]')
    : 'An unexpected error occurred';

  const payload = {
    success: false,
    message: sanitizedMessage,
    errorCode,
  };

  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(payload),
  };
}

export function optionsResponse() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: '',
  };
}
