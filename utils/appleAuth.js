const jwt = require('jsonwebtoken');

function generateAppleAuthToken() {
  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  if (!issuerId || !keyId || !privateKey) {
    console.log('Apple credentials are not properly configured');
    throw new Error('Apple credentials are not properly configured');
  }

  const token = jwt.sign(
    {},
    privateKey,
    {
      algorithm: 'ES256',
      expiresIn: '5m',
      issuer: issuerId,
      audience: 'appstoreconnect-v1', // ✅ REQUIRED
      header: {
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT'
      }
    }
  );

  return token;
}

module.exports = {
  generateAppleAuthToken
};
