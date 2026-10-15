/**
 * App version thresholds for the in-app update prompt.
 * Bump latest* when publishing a new store release; raise min* to force older builds to update.
 *
 * Store URLs are loaded from the inviteLinks collection (see appVersionService).
 *
 * Current live builds: Android 40 (1.1.23), iOS ~1.2.6 (1)
 * Next release (with update checker): Android 41 (1.1.23), iOS 1.2.7 (1)
 */
const appVersionThresholds = {
  android: {
    minVersionCode: Number(process.env.APP_ANDROID_MIN_VERSION_CODE) || 43,
    latestVersionCode: Number(process.env.APP_ANDROID_LATEST_VERSION_CODE) || 43,
    minVersionName: process.env.APP_ANDROID_MIN_VERSION_NAME || '1.2.0',
    latestVersionName: process.env.APP_ANDROID_LATEST_VERSION_NAME || '1.2.0',
  },
  ios: {
    minVersion: process.env.APP_IOS_MIN_VERSION || '1.3.0',
    latestVersion: process.env.APP_IOS_LATEST_VERSION || '1.3.0',
    minBuildNumber: Number(process.env.APP_IOS_MIN_BUILD_NUMBER) || 1,
    latestBuildNumber: Number(process.env.APP_IOS_LATEST_BUILD_NUMBER) || 1,
  },
  releaseNotes: {
    en:
      process.env.APP_RELEASE_NOTES_EN ||
      'A new version of women-help-api is available with improvements.',
    de:
      process.env.APP_RELEASE_NOTES_DE ||
      'Eine neue Version von women-help-api mit Verbesserungen ist verfügbar.',
  },
};

module.exports = appVersionThresholds;
