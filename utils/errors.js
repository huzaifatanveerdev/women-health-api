/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

/**
 * Custom error class for user already exists
 */
class UserExistsError extends Error {
  constructor(message = 'User with this email already exists') {
    super(message);
    this.name = 'UserExistsError';
    this.statusCode = 400;
  }
}

/**
 * Custom error class for database errors
 */
class DatabaseError extends Error {
  constructor(message = 'Database operation failed') {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
  }
}

/**
 * Custom error class for authentication failures
 */
class AuthenticationError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

module.exports = {
  ValidationError,
  UserExistsError,
  DatabaseError,
  AuthenticationError
}; 