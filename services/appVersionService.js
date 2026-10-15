const InviteLink = require('../models/InviteLink');
const appVersionThresholds = require('../config/appVersion');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');

/**
 * Build the app version payload with store URLs from inviteLinks.
 * @param {string} language - Language code (en or de)
 */
const getAppVersionConfig = async (language = 'en') => {
  try {
    const inviteLink = await InviteLink.findOne();

    const androidStoreUrl = inviteLink?.invite?.android;
    const iosStoreUrl = inviteLink?.invite?.ios;

    if (!androidStoreUrl || !iosStoreUrl) {
      throw new ValidationError(
        getLocalizedMessage('invite.unavailable', language) ||
          'Store links are unavailable, please try again later.',
      );
    }

    return {
      android: {
        ...appVersionThresholds.android,
        storeUrl: androidStoreUrl,
      },
      ios: {
        ...appVersionThresholds.ios,
        storeUrl: iosStoreUrl,
      },
      releaseNotes: appVersionThresholds.releaseNotes,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(
      getLocalizedMessage('failed.get.app.version', language) ||
        'Failed to get app version configuration',
    );
  }
};

module.exports = {
  getAppVersionConfig,
};
