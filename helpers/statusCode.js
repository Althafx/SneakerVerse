const HttpStatus = {
    // 2xx Success
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,

    // 3xx Redirection
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    SEE_OTHER: 303,
    NOT_MODIFIED: 304,
    TEMPORARY_REDIRECT: 307,
    PERMANENT_REDIRECT: 308,

    // 4xx Client Errors
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    CONFLICT: 409,
    GONE: 410,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,

    // 5xx Server Errors
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

// Helper function to check if a status code is successful (2xx)
HttpStatus.isSuccess = function(statusCode) {
    return statusCode >= 200 && statusCode < 300;
};

// Helper function to check if a status code is a client error (4xx)
HttpStatus.isClientError = function(statusCode) {
    return statusCode >= 400 && statusCode < 500;
};

// Helper function to check if a status code is a server error (5xx)
HttpStatus.isServerError = function(statusCode) {
    return statusCode >= 500 && statusCode < 600;
};

// Helper function to get status code name by code
HttpStatus.getName = function(statusCode) {
    return Object.keys(this).find(key => this[key] === statusCode) || 'UNKNOWN_STATUS';
};

module.exports = HttpStatus;