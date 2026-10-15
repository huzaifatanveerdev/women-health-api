const { google } = require('googleapis');

function getGoogleAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Google service account key not configured');
  }

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  return auth;
}

module.exports = {
  getGoogleAuth
};
