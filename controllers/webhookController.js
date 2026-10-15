const { processRevenueCatEvent } = require('../services/revenuecatWebhookService');

exports.handleRevenueCatWebhook = async (req, res) => {
  console.log('RevenueCat webhook received');
  console.log('req.body: ', req.body);

  try {
    const authHeader = req.headers.authorization;
    console.log('authHeader: ', authHeader);

    if (!authHeader || authHeader !== process.env.REVENUECAT_WEBHOOK_SECRET) {
      console.error('Invalid webhook authorization');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log('authHeader matched');

    const { event } = req.body;

    if (!event) {
      console.warn('No event object in webhook payload');
      return res.status(200).json({ received: true });
    }

    console.log('RevenueCat event type:', event.type);

    // Respond FIRST, then process
    res.status(200).json({ received: true });

    // Now process — if this throws, RevenueCat already got 200
    await processRevenueCatEvent(event);

  } catch (error) {
    console.error('RevenueCat webhook error:', error);
    // Only reachable if error happens before res.status(200)
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
};
  
  