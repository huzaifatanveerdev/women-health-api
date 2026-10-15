const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for user
 * @param {Object} payload - Token payload (user data)
 * @param {string} customExpiresIn - Custom expiration time (optional)
 * @returns {string} - JWT token
 */
const generateToken = (payload, customExpiresIn = null) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = customExpiresIn || process.env.JWT_EXPIRES_IN || '7d';

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header
 * @returns {string} - JWT token
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header must start with Bearer');
  }

  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

// Enum for temp token types
const TempTokenType = {
  REGISTRATION: 'registration',
  RESET_PASSWORD: 'reset-password'
};

/**
 * Validate temporary token for registration or reset-password
 * @param {string} token - Temporary JWT token
 * @param {string} expectedType - TempTokenType.REGISTRATION or TempTokenType.RESET_PASSWORD
 * @returns {Object} - Decoded token payload
 */
const validateTempToken = (token, expectedType) => {
  try {
    const decoded = verifyToken(token);
    if (!decoded.otpVerified || decoded.type !== expectedType) {
      throw new Error('Invalid or expired temporary token');
    }
    return decoded;
  } catch (error) {
    if (error.message.includes('expired')) {
      throw new Error('Temporary token has expired');
    }
    throw new Error('Invalid or expired temporary token');
  }
};

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  validateTempToken,
  TempTokenType
}; 