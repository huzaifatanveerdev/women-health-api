const jwt = require('jsonwebtoken');

function normalizeAppleTransaction(appleResponse) {
  const signedTransaction = appleResponse.signedTransactionInfo;

  if (!signedTransaction) {
    throw new Error('Invalid Apple transaction response');
  }

  // Decode without verifying signature (Apple already signed it)
  const decoded = jwt.decode(signedTransaction);

  if (!decoded.expiresDate) {
    throw new Error('Apple subscription missing expiresDate');
  }

  return {
    platform: 'apple',
    productId: decoded.productId,
    originalTransactionId: decoded.originalTransactionId,
    purchaseDate: new Date(decoded.purchaseDate),
    expiresDate: new Date(decoded.expiresDate),
    isCanceled: !!decoded.revocationDate,
    isRevoked: !!decoded.revocationDate
  };
}
  
function normalizeGoogleSubscription(data, subscriptionId, purchaseToken) {
  const purchaseDate = new Date(Number(data.startTimeMillis));
  const expiresDate = new Date(Number(data.expiryTimeMillis));

  const isCanceled = data.autoRenewing === false;
  const isRevoked = data.cancelReason === 1; // 1 = user canceled

  return {
    platform: 'google',
    productId: subscriptionId,
    originalTransactionId: data.linkedPurchaseToken || purchaseToken,
    purchaseDate,
    expiresDate,
    isCanceled,
    isRevoked
  };
}


module.exports = {
    normalizeAppleTransaction,
    normalizeGoogleSubscription
};
  

/** 
 * Every store response must be converted to this:
{
  platform: 'apple' | 'google',
  productId: 'com.women-help-api.impact',
  originalTransactionId: '...',
  purchaseDate: Date,
  expiresDate: Date,
  isCanceled: Boolean,
  isRevoked: Boolean
}

*/