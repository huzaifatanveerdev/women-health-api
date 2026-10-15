const { generateAppleAuthToken } = require('../utils/appleAuth');

async function testAppleConnection() {
  const token = generateAppleAuthToken();

  const response = await fetch(
    `https://api.storekit.itunes.apple.com/inApps/v1/apps/${process.env.APPLE_BUNDLE_ID}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const text = await response.text();

    let data;
    try {
        data = JSON.parse(text);
    console.log(data);
    } catch {
        console.log(text);
        data = text;
    }

  return {
    status: response.status,
    data
  };
}

async function getTransactionDetails(transactionId) {
    const token = generateAppleAuthToken();
  
    const response = await fetch(
      `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${transactionId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  
    const text = await response.text();
  
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Apple response not JSON: ${text}`);
    }
  
    if (!response.ok) {
      throw new Error(`Apple API error: ${response.status}`);
    }
  
    return data;
  }
  

module.exports = {
  testAppleConnection,
  getTransactionDetails
};
