const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { AuthenticationError } = require('../utils/errors');

/**
 * Authentication middleware to protect routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('Access token is required');
    }

    // Extract token from Authorization header
    const token = extractTokenFromHeader(authHeader);

    // Verify token
    const decoded = verifyToken(token);

    // Add user info to request object
    req.user = decoded;

    next();
  } catch (error) {
    if (error.message.includes('Authorization header') || 
        error.message.includes('Token has expired') || 
        error.message.includes('Invalid token')) {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

module.exports = {
  authenticateToken
}; 