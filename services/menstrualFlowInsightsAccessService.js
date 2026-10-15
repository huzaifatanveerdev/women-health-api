const { hasActiveSubscription } = require('./subscriptionService');

/**
 * Whether the user may access menstrual flow insights (admin bypass or active subscription).
 * @param {string} userId
 * @param {string} email
 * @returns {Promise<{ hasAccess: boolean }>}
 */
async function getMenstrualFlowInsightsAccess(userId, email) {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (adminEmail && email) {
    const userEmail = email.toLowerCase().trim();
    const configuredAdminEmail = adminEmail.toLowerCase().trim();

    if (userEmail === configuredAdminEmail) {
      return { hasAccess: true };
    }
  }

  const subscribed = await hasActiveSubscription(userId);
  return { hasAccess: subscribed };
}

module.exports = {
  getMenstrualFlowInsightsAccess
};
