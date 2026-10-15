/**
 * Admin authorization middleware - checks if logged-in user's email matches ADMIN_EMAIL from .env
 * Must be used after authenticateToken middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated (should be set by authenticateToken middleware)
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;

    // Check if ADMIN_EMAIL is configured
    if (!adminEmail) {
      return res.status(500).json({
        success: false,
        message: 'Admin email not configured'
      });
    }

    const userEmail = req.user.email.toLowerCase().trim();
    const configuredAdminEmail = adminEmail.toLowerCase().trim();

    // Check if user's email matches the admin email from .env
    if (userEmail !== configuredAdminEmail) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // User is an admin, proceed to next middleware
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking admin privileges'
    });
  }
};

module.exports = {
  requireAdmin
};

