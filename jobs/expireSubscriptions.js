const cron = require('node-cron');
const Subscription = require('../models/Subscription');

async function runExpireSubscriptions() {
  try {
    console.log('Expire subscriptions job started');
    const now = new Date();
    const result = await Subscription.updateMany(
      {
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { $lte: now }
      },
      {
        $set: {
          status: 'expired',
          autoRenew: false
        }
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`Cron: Expired ${result.modifiedCount} subscriptions`);
    } else {
      console.log('Expire subscriptions job: no subscriptions to expire');
    }
  } catch (error) {
    console.error('Cron job error:', error);
  }
}

// Runs every 15 minutes
cron.schedule('*/15 * * * *', runExpireSubscriptions);

module.exports = { runExpireSubscriptions };