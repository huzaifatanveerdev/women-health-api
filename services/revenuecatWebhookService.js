const Subscription = require('../models/Subscription');
const subscriptionPlans = require('../config/subscriptionPlans');
const User = require('../models/User');
const CollectiveProgress = require('../models/CollectiveProgress');
const ImpactRecord = require('../models/ImpactRecord');
const { sendSubscriptionPurchaseEmail, sendSubscriptionCancellationEmail, sendAdminImpactFailureEmail } = require('./sendGridEmailService');

const monthsMap = {
  'impact': 1,
  'impactplus': 5,
  'maximpact': 12,
  // Grandfathered yearly Impact (productId `com.women-help-api.impact`). Each renewal
  // credits 3 months — preserves the original "yearly = 3 months of access"
  // contract for the small set of users who bought before Impact became monthly.
  'impact_legacy_yearly': 3
};

function getPlanKeyFromProductId(productId) {
  console.log('getPlanKeyFromProductId() called with productId: ', productId);
  // Google Play sends "<productId>:<basePlanId>" (e.g. com.women-help-api.impact.monthly:monthly).
  // Apple sends just the productId. Strip everything after the first colon to get the bare product ID.
  const normalized = productId.split(':')[0];
  const plan = subscriptionPlans.find(p => p.productId === normalized);
  return plan ? plan.key : null;
}

async function processRevenueCatEvent(event) {
  const {
    app_user_id,
    product_id,
    expiration_at_ms,
    purchased_at_ms,
    type,
    store,
    transaction_id
  } = event;

  console.log('event: ', event);
  console.log('product_id: ', product_id);
  console.log('expiration_at_ms: ', expiration_at_ms);
  console.log('purchased_at_ms: ', purchased_at_ms);
  console.log('type: ', type);
  console.log('store: ', store);
  console.log('app_user_id: ', app_user_id);

  const user = await User.findOne({ email: app_user_id });

  //const userId = app_user_id;

  // Validate user existence
  //const user = await User.findById(userId);

  if (!user) {
    console.warn('RevenueCat event for non-existent user:', app_user_id);
    return;
  }

  // Do NOT auto-reactivate soft deleted users
  if (user.isDeleted) {
    console.warn('RevenueCat event for soft-deleted user:', app_user_id);
    return;
  }

  // Use MongoDB _id for all database operations
  const userId = user._id;

  const planKey = getPlanKeyFromProductId(product_id);
  console.log('planKey: ', planKey);

  if (!planKey) {
    console.warn('Unknown product_id from RevenueCat:', product_id);
    return;
  }

  const expirationDate = expiration_at_ms ? new Date(expiration_at_ms) : null;
  const purchaseDate = purchased_at_ms ? new Date(purchased_at_ms) : new Date();
  const platform = store === 'PLAY_STORE' ? 'google' : 'apple';

  const existingSubscription = await Subscription.findOne({ userId });

  // GUARD: Ignore stale EXPIRATION events that would overwrite a newer active subscription
  if (
    type === 'EXPIRATION' &&
    existingSubscription &&
    existingSubscription.status === 'active' &&
    existingSubscription.currentPeriodEnd > new Date(expiration_at_ms)
  ) {
    console.log('Ignoring stale EXPIRATION event — newer active subscription exists');
    return;
  }

  let status = 'active';
  let autoRenew = true;
  let cancelAtPeriodEnd = false;

  if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL' || type === 'RESUBSCRIBE') {
    status = 'active';
    autoRenew = true;
    cancelAtPeriodEnd = false;
  }

  if (type === 'UNCANCELLATION') {
    status = 'active';
    autoRenew = true;
    cancelAtPeriodEnd = false;
  }

  if (type === 'CANCELLATION') {
    status = 'active'; // still active until period ends
    cancelAtPeriodEnd = true;
    autoRenew = false;
  }

  if (type === 'EXPIRATION') {
    status = 'expired';
    autoRenew = false;
    cancelAtPeriodEnd = false;
  }

  if (type === 'PAUSE') {
    status = 'paused';
    autoRenew = true;
    cancelAtPeriodEnd = false;
  }
  
  if (type === 'RESUME') {
    status = 'active';
    autoRenew = true;
    cancelAtPeriodEnd = false;
  }

  if (type === 'PRODUCT_CHANGE') {
    status = 'active';
    autoRenew = true;
    cancelAtPeriodEnd = false;
  }

  const updateData = {
    userId,
    platform,
    productId: product_id,
    planKey,
    status,
    autoRenew,
    cancelAtPeriodEnd,
    currentPeriodStart: purchaseDate,
    currentPeriodEnd: expirationDate,
    storeSubscriptionId: transaction_id || `${userId}_${product_id}`,
    lastVerifiedAt: new Date()
  };

  if (existingSubscription) {
    console.log('existingSubscription found, updating...');
    await Subscription.updateOne({ userId }, updateData);
  } else {
    console.log('no existing subscription found, creating...');
    await Subscription.create(updateData);
  }

  console.log(`Subscription synced for user ${userId}`);

  // Create ImpactRecord and increment collective progress.
  //
  // IMPORTANT — idempotency contract:
  //   RevenueCat explicitly may redeliver the same webhook event (their docs
  //   recommend the consumer be idempotent). `ImpactRecord.transactionId` has a
  //   unique index, so the *record* is safe. We must also guard the counter
  //   updates behind the same dedup check, otherwise a redelivery would inflate
  //   `womenHelped` (and any future denormalised counters) while quietly skipping
  //   the record. Side effects are gated on a *new* ImpactRecord being created.
  //
  // IMPORTANT — error policy:
  //   Impact bookkeeping must NEVER block the user emails below. The user has
  //   already been charged; they must receive their purchase / cancellation email.
  //   On a real failure we notify ADMIN_EMAIL with full context (so the admin can
  //   manually insert the ImpactRecord) and fall through. Duplicate cases (existing
  //   record / E11000 race) are NOT failures — they're expected idempotency
  //   behaviour, so they skip side effects (including the user email, to avoid
  //   double-sending on webhook redelivery) without an admin alert.
  if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL' || type === 'RESUBSCRIBE') {
    const monthsCommitted = monthsMap[planKey];

    if (typeof monthsCommitted !== 'number') {
      // Unknown planKey — can't compute monthsCommitted/commitmentEndDate, so we
      // cannot create an ImpactRecord. Notify admin and fall through so the user
      // still receives their purchase email below.
      console.warn(`Unknown planKey "${planKey}" in monthsMap — notifying admin and skipping impact bookkeeping`);
      await sendAdminImpactFailureEmail({
        user,
        planKey,
        productId: product_id,
        eventType: type,
        transactionId: transaction_id,
        purchaseDate,
        platform,
        reason: `Unknown planKey "${planKey}" — not present in monthsMap. Impact bookkeeping skipped; manual ImpactRecord required.`
      });
    } else {
      try {
        const commitmentEndDate = new Date(purchaseDate);
        commitmentEndDate.setMonth(commitmentEndDate.getMonth() + monthsCommitted);

        // Dedup first. Two layers:
        //  1) Cheap pre-check via findOne — avoids an unnecessary duplicate-key error log.
        //  2) Catch E11000 on create — handles the race where two concurrent webhook
        //     workers pass the pre-check and both attempt to insert the same txn.
        const existingRecord = await ImpactRecord.findOne({ transactionId: transaction_id });
        if (existingRecord) {
          // Idempotency: redelivered webhook. The first delivery already created
          // the ImpactRecord, incremented counters AND sent the user email. We
          // intentionally `return` here to avoid double-sending the user email
          // below. Not an error — no admin notification needed.
          console.log('ImpactRecord already exists for transaction:', transaction_id, '— skipping all impact side effects (idempotency)');
          return;
        }

        let createdNewRecord = false;
        try {
          await ImpactRecord.create({
            userId,
            planKey,
            monthsCommitted,
            transactionId: transaction_id,
            eventType: type,
            purchaseDate,
            commitmentEndDate,
            platform
          });
          createdNewRecord = true;
        } catch (createErr) {
          if (createErr && createErr.code === 11000) {
            // Concurrent worker won the race. Same idempotency case as
            // `existingRecord` above — bail out cleanly, no admin alert.
            console.log('ImpactRecord insert collided on transactionId, treating as duplicate (idempotency):', transaction_id);
            return;
          }
          // Genuine failure. Notify admin with full context and fall through so
          // the user still receives their purchase/cancellation email.
          console.error('Failed to create ImpactRecord — notifying admin:', createErr && createErr.message ? createErr.message : createErr);
          await sendAdminImpactFailureEmail({
            user,
            planKey,
            productId: product_id,
            eventType: type,
            transactionId: transaction_id,
            monthsCommitted,
            purchaseDate,
            platform,
            reason: (createErr && createErr.message) ? createErr.message : String(createErr),
            errorStack: createErr && createErr.stack
          });
        }

        if (createdNewRecord) {
          console.log(`ImpactRecord created for user ${userId} — ${monthsCommitted} months committed`);

          // Only after a *new* ImpactRecord was successfully persisted do we touch
          // the denormalised V0 counter. Keeps `CollectiveProgress.womenHelped`
          // and the V1 aggregation over ImpactRecord in lockstep.
          try {
            const progress = await CollectiveProgress.getOrCreate();
            progress.womenHelped += 1;
            await progress.save();
            console.log(`CollectiveProgress.womenHelped incremented to ${progress.womenHelped}`);
          } catch (counterErr) {
            // V0 counter drifted from the V1 aggregation. ImpactRecord IS in place
            // (so V1 is correct), but `womenHelped` missed an increment. Alert
            // admin so they can run a one-line `$inc` fix, and fall through.
            console.error('Failed to increment CollectiveProgress.womenHelped — notifying admin:', counterErr && counterErr.message ? counterErr.message : counterErr);
            await sendAdminImpactFailureEmail({
              user,
              planKey,
              productId: product_id,
              eventType: type,
              transactionId: transaction_id,
              monthsCommitted,
              purchaseDate,
              platform,
              reason: `ImpactRecord was created successfully, but CollectiveProgress.womenHelped failed to increment: ${(counterErr && counterErr.message) ? counterErr.message : String(counterErr)}. V1 aggregation is correct; only the V0 counter is short by 1.`,
              errorStack: counterErr && counterErr.stack
            });
          }
        }
      } catch (progressError) {
        // Defensive catch-all for anything we missed (e.g. the findOne pre-check
        // throwing). Never throw — never block the user emails below.
        console.error('Unexpected failure during impact bookkeeping — notifying admin:', progressError && progressError.message ? progressError.message : progressError);
        await sendAdminImpactFailureEmail({
          user,
          planKey,
          productId: product_id,
          eventType: type,
          transactionId: transaction_id,
          monthsCommitted,
          purchaseDate,
          platform,
          reason: (progressError && progressError.message) ? progressError.message : String(progressError),
          errorStack: progressError && progressError.stack
        });
      }
    }
  }

  // Send purchase email only on initial purchase
  if (type === 'INITIAL_PURCHASE') {
    try {
      const userLanguage = user?.settings?.language || 'en';
      const userName = user?.name || '';
      const userEmail = user?.email || '';

      if (!userEmail) {
        console.warn('No email found for user:', userId);
        return;
      }

      await sendSubscriptionPurchaseEmail(
        userEmail,
        userName,
        planKey,
        userLanguage
      );

      console.log(`Purchase email sent to ${userEmail} for plan ${planKey}`);
    } catch (emailError) {
      // Do not throw — email failure should never affect subscription sync
      console.error('Failed to send purchase email:', emailError);
    }
  }

  // Send cancellation email when user cancels (premium access until currentPeriodEnd)
  if (type === 'CANCELLATION') {
    try {
      const userLanguage = user?.settings?.language || 'en';
      const userName = user?.name || '';
      const userEmail = user?.email || '';

      if (!userEmail) {
        console.warn('No email found for user:', userId);
        return;
      }

      await sendSubscriptionCancellationEmail(
        userEmail,
        userName,
        planKey,
        expirationDate,
        userLanguage
      );

      console.log(`Cancellation email sent to ${userEmail}`);
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }
  }
}

module.exports = {
  processRevenueCatEvent
};