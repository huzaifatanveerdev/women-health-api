const sgMail = require('@sendgrid/mail');
const { getLocalizedMessage } = require('../utils/localization');

/**
 * Initialize SendGrid with API key
 */
const initializeSendGrid = () => {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is required');
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
};

/**
 * Send OTP email using SendGrid
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP
 * @param {string} otpType - Type of OTP ('registration' or 'reset-password')
 * @param {string} language - Language code (en or de)
 * @returns {Promise} - Email sending result
 */
const sendOtpEmail = async (email, otp, otpType = 'registration', language = 'en') => {
  try {
    // Initialize SendGrid
    initializeSendGrid();

    const duration = process.env.OTP_EXPIRES_IN || '5 minutes';
    let subject, title, greeting, validity, ignore, backgroundColor;
    
    if (otpType === 'reset-password') {
      subject = getLocalizedMessage('email.reset.subject', language);
      title = getLocalizedMessage('email.reset.title', language);
      greeting = getLocalizedMessage('email.reset.greeting', language);
      validity = getLocalizedMessage('email.reset.validity', language, { duration });
      ignore = getLocalizedMessage('email.reset.ignore', language);
      backgroundColor = '#dc3545'; // Red for password reset
    } else {
      subject = getLocalizedMessage('email.registration.subject', language);
      title = getLocalizedMessage('email.registration.title', language);
      greeting = getLocalizedMessage('email.registration.greeting', language);
      validity = getLocalizedMessage('email.registration.validity', language, { duration });
      ignore = getLocalizedMessage('email.registration.ignore', language);
      backgroundColor = '#007bff'; // Blue for registration
    }
    
    const footerText = getLocalizedMessage('email.footer.automated', language);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">${title}</h2>
          <p style="color: #666; margin-bottom: 20px;">
            ${greeting}
          </p>
          <div style="background-color: ${backgroundColor}; color: white; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
            ${validity}
          </p>
          <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
            ${ignore}
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            ${footerText}
          </p>
        </div>
      </div>
    `;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM,
      subject: subject,
      html: html,
    };

    const result = await sgMail.send(msg);
    console.log('SendGrid OTP email sent successfully:', result[0].statusCode);
    return result;

  } catch (error) {
    console.error('Error sending SendGrid OTP email:', error);
    
    // Provide more specific error messages
    if (error.code === 403) {
      if (error.response && error.response.body && error.response.body.errors) {
        const errorDetails = error.response.body.errors.map(err => err.message).join(', ');
        throw new Error(`SendGrid authentication failed: ${errorDetails}. Please check your API key and sender email verification.`);
      } else {
        throw new Error('SendGrid authentication failed (403 Forbidden). Please check your API key and sender email verification.');
      }
    } else if (error.code === 401) {
      throw new Error('SendGrid API key is invalid or missing. Please check your SENDGRID_API_KEY.');
    } else if (error.code === 400) {
      throw new Error('SendGrid request is invalid. Please check your sender email address.');
    } else {
      throw new Error(`Failed to send OTP email via SendGrid: ${error.message}`);
    }
  }
};

/**
 * Send welcome email using SendGrid
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} language - Language code (en or de)
 * @returns {Promise} - Email sending result
 */
const sendWelcomeEmail = async (email, name, language = 'en') => {
  try {
    // Initialize SendGrid
    initializeSendGrid();

    const subject = getLocalizedMessage('email.welcome.subject', language);
    // Use a name-less greeting variant when we don't have a real name for
    // the user (e.g. Apple SSO sign-ins after the first, where Apple never
    // re-issues fullName). Avoids "Hi undefined," / "Hi ,".
    const hasName = typeof name === 'string' && name.trim().length > 0;
    const greeting = hasName
      ? getLocalizedMessage('email.welcome.greeting', language, { name })
      : getLocalizedMessage('email.welcome.greeting.noName', language);
    const paragraph1 = getLocalizedMessage('email.welcome.paragraph1', language);
    const paragraph2 = getLocalizedMessage('email.welcome.paragraph2', language);
    const paragraph3 = getLocalizedMessage('email.welcome.paragraph3', language);
    const paragraph4 = getLocalizedMessage('email.welcome.paragraph4', language);
    const paragraph5 = getLocalizedMessage('email.welcome.paragraph5', language);
    const signature = getLocalizedMessage('email.welcome.signature', language);
    const footerText = getLocalizedMessage('email.footer.automated', language);

    // Replace newlines in signature with HTML line breaks
    const signatureHtml = signature.replace(/\n/g, '<br>');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h2 style="color: #333; margin-bottom: 20px; text-align: center;">${subject.replace(' — You\'re in the Circle ❤', '').replace('Du bist jetzt im Kreis ❤', '')}</h2>
          <div style="color: #333; line-height: 1.6; font-size: 16px;">
            <p style="margin-bottom: 15px;">${greeting}</p>
            <p style="margin-bottom: 15px;">${paragraph1}</p>
            <p style="margin-bottom: 15px;">${paragraph2}</p>
            <p style="margin-bottom: 15px;">${paragraph3}</p>
            <p style="margin-bottom: 15px;">${paragraph4}</p>
            <p style="margin-bottom: 20px;">${paragraph5}</p>
            <div style="margin-top: 30px; margin-bottom: 20px;">
              ${signatureHtml}
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            ${footerText}
          </p>
        </div>
      </div>
    `;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM,
      subject: subject,
      html: html,
    };

    const result = await sgMail.send(msg);
    console.log('SendGrid welcome email sent successfully:', result[0].statusCode);
    return result;

  } catch (error) {
    console.error('Error sending SendGrid welcome email:', error);
    
    // Provide more specific error messages
    if (error.code === 403) {
      if (error.response && error.response.body && error.response.body.errors) {
        const errorDetails = error.response.body.errors.map(err => err.message).join(', ');
        throw new Error(`SendGrid authentication failed: ${errorDetails}. Please check your API key and sender email verification.`);
      } else {
        throw new Error('SendGrid authentication failed (403 Forbidden). Please check your API key and sender email verification.');
      }
    } else if (error.code === 401) {
      throw new Error('SendGrid API key is invalid or missing. Please check your SENDGRID_API_KEY.');
    } else if (error.code === 400) {
      throw new Error('SendGrid request is invalid. Please check your sender email address.');
    } else {
      throw new Error(`Failed to send welcome email via SendGrid: ${error.message}`);
    }
  }
};

/**
 * Send subscription purchase confirmation email using SendGrid
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} planName - Subscription plan name (impact, impactplus, or maximpact)
 * @param {string} language - Language code (en or de)
 * @returns {Promise} - Email sending result
 */
const sendSubscriptionPurchaseEmail = async (email, name, planName, language = 'en') => {
  try {
    // Initialize SendGrid
    initializeSendGrid();

    const subject = getLocalizedMessage('email.subscription.subject', language);
    const greeting = getLocalizedMessage('email.subscription.greeting', language, { name });
    const paragraph1 = getLocalizedMessage('email.subscription.paragraph1', language);
    const paragraph2 = getLocalizedMessage('email.subscription.paragraph2', language);
    const paragraph3 = getLocalizedMessage('email.subscription.paragraph3', language);
    const paragraph4 = getLocalizedMessage('email.subscription.paragraph4', language);
    const paragraph5 = getLocalizedMessage('email.subscription.paragraph5', language);
    const paragraph6 = getLocalizedMessage('email.subscription.paragraph6', language);
    const signature = getLocalizedMessage('email.subscription.signature', language);
    const footerText = getLocalizedMessage('email.footer.automated', language);

    // Determine which impact text to use based on plan name.
    //
    // NOTE: order matters. `impact_legacy_yearly` and `impactplus` / `maximpact`
    // all contain the substring "impact", so they MUST be matched before the
    // generic `.includes('impact')` fallthrough — otherwise legacy yearly users
    // would get the "1 month" copy instead of the correct "3 months" copy.
    let impactText = '';
    const planNameLower = (planName || '').toLowerCase();

    if (planNameLower === 'impact_legacy_yearly') {
      impactText = getLocalizedMessage('email.subscription.impact.impactLegacyYearly', language);
    } else if (planNameLower.includes('maximpact') || planNameLower === 'maximpact') {
      impactText = getLocalizedMessage('email.subscription.impact.max', language);
    } else if (planNameLower.includes('impactplus') || planNameLower === 'impactplus') {
      impactText = getLocalizedMessage('email.subscription.impact.plus', language);
    } else if (planNameLower.includes('impact') || planNameLower === 'impact') {
      impactText = getLocalizedMessage('email.subscription.impact.impact', language);
    } else {
      // Default to Impact if plan name doesn't match
      impactText = getLocalizedMessage('email.subscription.impact.impact', language);
    }

    // Replace newlines in signature with HTML line breaks
    const signatureHtml = signature.replace(/\n/g, '<br>');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h2 style="color: #333; margin-bottom: 20px; text-align: center;">${subject.replace(' 💛', '')}</h2>
          <div style="color: #333; line-height: 1.6; font-size: 16px;">
            <p style="margin-bottom: 15px;">${greeting}</p>
            <p style="margin-bottom: 15px;">${paragraph1}</p>
            <p style="margin-bottom: 15px;">${paragraph2}</p>
            <p style="margin-bottom: 15px;">${paragraph3}</p>
            <p style="margin-bottom: 15px;">${paragraph4}</p>
            <p style="margin-bottom: 15px; font-weight: 600; color: #ff6b6b;">${impactText}</p>
            <p style="margin-bottom: 15px;">${paragraph5}</p>
            <p style="margin-bottom: 20px;">${paragraph6}</p>
            <div style="margin-top: 30px; margin-bottom: 20px;">
              ${signatureHtml}
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            ${footerText}
          </p>
        </div>
      </div>
    `;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM,
      subject: subject,
      html: html,
    };

    const result = await sgMail.send(msg);
    console.log('SendGrid subscription purchase email sent successfully:', result[0].statusCode);
    return result;

  } catch (error) {
    console.error('Error sending SendGrid subscription purchase email:', error);
    
    // Provide more specific error messages
    if (error.code === 403) {
      if (error.response && error.response.body && error.response.body.errors) {
        const errorDetails = error.response.body.errors.map(err => err.message).join(', ');
        throw new Error(`SendGrid authentication failed: ${errorDetails}. Please check your API key and sender email verification.`);
      } else {
        throw new Error('SendGrid authentication failed (403 Forbidden). Please check your API key and sender email verification.');
      }
    } else if (error.code === 401) {
      throw new Error('SendGrid API key is invalid or missing. Please check your SENDGRID_API_KEY.');
    } else if (error.code === 400) {
      throw new Error('SendGrid request is invalid. Please check your sender email address.');
    } else {
      throw new Error(`Failed to send subscription purchase email via SendGrid: ${error.message}`);
    }
  }
};

/**
 * Send subscription cancellation email using SendGrid
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {string} planKey - Subscription plan key (impact, impactplus, or maximpact)
 * @param {Date} accessEndDate - Date until which premium access remains active
 * @param {string} language - Language code (en or de)
 * @returns {Promise} - Email sending result
 */
const sendSubscriptionCancellationEmail = async (email, name, planKey, accessEndDate, language = 'en') => {
  try {
    initializeSendGrid();

    const locale = language === 'de' ? 'de-DE' : 'en-GB';
    const formattedDate = accessEndDate ? new Date(accessEndDate).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    // Order matters here for the same reason as in `sendSubscriptionPurchaseEmail`:
    // `impact_legacy_yearly` and `impactplus` / `maximpact` all contain the
    // substring "impact", so the legacy/plus/max branches MUST run before the
    // generic `.includes('impact')` fallthrough — otherwise grandfathered yearly
    // Impact users would see "one month" instead of the correct "three months".
    const planKeyLower = (planKey || '').toLowerCase();
    let impactDuration = getLocalizedMessage('email.cancellation.impact.impact', language);
    if (planKeyLower === 'impact_legacy_yearly') {
      impactDuration = getLocalizedMessage('email.cancellation.impact.impactLegacyYearly', language);
    } else if (planKeyLower.includes('maximpact') || planKeyLower === 'maximpact') {
      impactDuration = getLocalizedMessage('email.cancellation.impact.max', language);
    } else if (planKeyLower.includes('impactplus') || planKeyLower === 'impactplus') {
      impactDuration = getLocalizedMessage('email.cancellation.impact.plus', language);
    } else if (planKeyLower.includes('impact') || planKeyLower === 'impact') {
      impactDuration = getLocalizedMessage('email.cancellation.impact.impact', language);
    }

    const subject = getLocalizedMessage('email.cancellation.subject', language);
    const greeting = getLocalizedMessage('email.cancellation.greeting', language, { name });
    const confirm = getLocalizedMessage('email.cancellation.confirm', language);
    const accessUntil = getLocalizedMessage('email.cancellation.accessUntil', language, { date: formattedDate });
    const thanks = getLocalizedMessage('email.cancellation.thanks', language);
    const impactIntro = getLocalizedMessage('email.cancellation.impactIntro', language, { impactDuration });
    const paragraph2 = getLocalizedMessage('email.cancellation.paragraph2', language);
    const returnText = getLocalizedMessage('email.cancellation.return', language);
    const feedback = getLocalizedMessage('email.cancellation.feedback', language).replace(/\n/g, '<br>');
    const wishing = getLocalizedMessage('email.cancellation.wishing', language);
    const signature = getLocalizedMessage('email.cancellation.signature', language).replace(/\n/g, '<br>');
    const footerText = getLocalizedMessage('email.footer.automated', language);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h2 style="color: #333; margin-bottom: 20px; text-align: center;">${subject}</h2>
          <div style="color: #333; line-height: 1.6; font-size: 16px;">
            <p style="margin-bottom: 15px;">${greeting}</p>
            <p style="margin-bottom: 15px;">${confirm}</p>
            <p style="margin-bottom: 15px;">${accessUntil}</p>
            <p style="margin-bottom: 15px;">${thanks}</p>
            <p style="margin-bottom: 15px;">${impactIntro}</p>
            <p style="margin-bottom: 15px;">${paragraph2}</p>
            <p style="margin-bottom: 15px;">${returnText}</p>
            <p style="margin-bottom: 15px;">${feedback}</p>
            <p style="margin-bottom: 15px;">${wishing}</p>
            <div style="margin-top: 30px;">${signature}</div>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">${footerText}</p>
        </div>
      </div>
    `;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM,
      subject,
      html
    };

    const result = await sgMail.send(msg);
    console.log('SendGrid subscription cancellation email sent successfully:', result[0].statusCode);
    return result;
  } catch (error) {
    console.error('Error sending SendGrid subscription cancellation email:', error);
    if (error.code === 403 || error.code === 401 || error.code === 400) {
      throw new Error(`SendGrid error: ${error.message}`);
    }
    throw new Error(`Failed to send subscription cancellation email via SendGrid: ${error.message}`);
  }
};

/**
 * Escape a string for safe inclusion in HTML.
 * Used by the admin-failure email to avoid injecting raw values (e.g. error
 * messages, productIds) into the HTML body.
 */
const escapeHtml = (value) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Notify the admin that impact bookkeeping (ImpactRecord create / counter
 * increment) failed for a RevenueCat webhook. The user has still been charged
 * and will still receive their normal purchase/cancellation email; this alert
 * lets the admin reconstruct the missing impact data manually.
 *
 * Sent to ADMIN_EMAIL from .env. English only — this is an operational alert,
 * not user-facing copy. Never throws (notification path must not break the
 * webhook handler that called it).
 *
 * @param {Object} payload
 * @param {Object} [payload.user]            - User document (or null)
 * @param {string} [payload.planKey]
 * @param {string} [payload.productId]
 * @param {string} [payload.eventType]       - INITIAL_PURCHASE / RENEWAL / RESUBSCRIBE / etc.
 * @param {string} [payload.transactionId]
 * @param {number} [payload.monthsCommitted]
 * @param {Date|string} [payload.purchaseDate]
 * @param {string} [payload.platform]        - 'apple' | 'google'
 * @param {string} [payload.reason]          - Short human-readable failure reason
 * @param {string} [payload.errorStack]      - Optional stack trace
 */
const sendAdminImpactFailureEmail = async (payload = {}) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.error('Cannot send admin impact-failure email: ADMIN_EMAIL not configured in .env');
      return;
    }

    initializeSendGrid();

    const {
      user,
      planKey,
      productId,
      eventType,
      transactionId,
      monthsCommitted,
      purchaseDate,
      platform,
      reason,
      errorStack
    } = payload;

    const userId = (user && (user._id || user.id)) ? String(user._id || user.id) : '(unknown)';
    const userEmail = (user && user.email) ? user.email : '(unknown)';
    const userName = (user && user.name) ? user.name : '(unknown)';
    const purchaseIso = purchaseDate ? new Date(purchaseDate).toISOString() : '';

    const subject = '[women-help-api] Impact record creation failed — manual action required';

    const row = (label, value) => `
      <tr>
        <td style="padding: 6px 12px; border: 1px solid #eee; background: #fafafa; width: 180px;"><strong>${escapeHtml(label)}</strong></td>
        <td style="padding: 6px 12px; border: 1px solid #eee;"><code>${escapeHtml(value || '(unknown)')}</code></td>
      </tr>`;

    const stackBlock = errorStack
      ? `<h3 style="color: #333; margin-top: 24px; margin-bottom: 10px;">Stack trace</h3>
         <pre style="background: #f7f7f7; padding: 12px; border-radius: 4px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(errorStack)}</pre>`
      : '';

    const manualFixSnippet = `db.impactrecords.insertOne({
  userId: ObjectId("${userId}"),
  planKey: "${planKey || ''}",
  monthsCommitted: ${monthsCommitted != null ? monthsCommitted : '/* derive from planKey: impact=1, impactplus=5, maximpact=12 */'},
  transactionId: "${transactionId || ''}",
  eventType: "${eventType || ''}",
  purchaseDate: ISODate("${purchaseIso}"),
  commitmentEndDate: /* purchaseDate + monthsCommitted months */,
  platform: "${platform || ''}",
  createdAt: new Date(),
  updatedAt: new Date()
});`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 20px; color: #222;">
        <div style="background-color: #fff3cd; border-left: 4px solid #b00020; padding: 16px 20px; border-radius: 6px; margin-bottom: 20px;">
          <h2 style="color: #b00020; margin: 0 0 8px 0;">Impact bookkeeping failed</h2>
          <p style="margin: 0; color: #555;">
            The user's purchase/renewal succeeded and the user has been (or will be) emailed normally,
            but the <code>ImpactRecord</code> could not be persisted. Please review the details below and
            create the record manually if appropriate.
          </p>
        </div>

        <h3 style="color: #333; margin-bottom: 10px;">User</h3>
        <table style="border-collapse: collapse; width: 100%;">
          ${row('userId', userId)}
          ${row('name', userName)}
          ${row('email', userEmail)}
        </table>

        <h3 style="color: #333; margin-top: 24px; margin-bottom: 10px;">Webhook</h3>
        <table style="border-collapse: collapse; width: 100%;">
          ${row('eventType', eventType)}
          ${row('productId', productId)}
          ${row('planKey', planKey)}
          ${row('transactionId', transactionId)}
          ${row('monthsCommitted', monthsCommitted != null ? String(monthsCommitted) : '')}
          ${row('purchaseDate', purchaseIso)}
          ${row('platform', platform)}
        </table>

        <h3 style="color: #333; margin-top: 24px; margin-bottom: 10px;">Failure reason</h3>
        <pre style="background: #f7f7f7; padding: 12px; border-radius: 4px; overflow: auto; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(reason || '(no message)')}</pre>

        ${stackBlock}

        <h3 style="color: #333; margin-top: 24px; margin-bottom: 10px;">Suggested manual fix</h3>
        <p style="color: #333;">Insert an <code>ImpactRecord</code> into MongoDB using the values above. Starter snippet:</p>
        <pre style="background: #1e1e1e; color: #f8f8f2; padding: 12px; border-radius: 4px; overflow: auto; font-size: 12px;">${escapeHtml(manualFixSnippet)}</pre>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Automated alert from the women-help-api backend (revenuecatWebhookService).
          This email is sent only when impact bookkeeping fails; normal duplicate-webhook
          deliveries do not trigger it.
        </p>
      </div>
    `;

    const msg = {
      to: adminEmail,
      from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM,
      subject,
      html
    };

    const result = await sgMail.send(msg);
    console.log(`SendGrid admin impact-failure email sent to ${adminEmail}: ${result[0].statusCode}`);
    return result;
  } catch (error) {
    // Notification path — must NEVER throw, must NEVER break the calling webhook.
    console.error('Failed to send admin impact-failure email:', error && error.message ? error.message : error);
  }
};

/**
 * Validate SendGrid email configuration
 * @returns {boolean} - True if configuration is valid
 */
const validateSendGridConfig = () => {
  const requiredFields = ['SENDGRID_API_KEY'];
  const missingFields = requiredFields.filter(field => !process.env[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing SendGrid configuration: ${missingFields.join(', ')}`);
  }
  
  return true;
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendSubscriptionPurchaseEmail,
  sendSubscriptionCancellationEmail,
  sendAdminImpactFailureEmail,
  validateSendGridConfig
};
