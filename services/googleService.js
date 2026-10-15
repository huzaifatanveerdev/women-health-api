const { google } = require('googleapis');
const { getGoogleAuth } = require('../utils/googleAuth');

async function getSubscriptionDetailsFromGoogle({
  packageName,
  subscriptionId,
  purchaseToken
}) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Google verification not configured');
  }

  const auth = getGoogleAuth();

  const androidPublisher = google.androidpublisher({
    version: 'v3',
    auth
  });

  const response = await androidPublisher.purchases.subscriptions.get({
    packageName,
    subscriptionId,
    token: purchaseToken
  });

  return response.data;
}

module.exports = {
  getSubscriptionDetailsFromGoogle
};
