const OtpVerification = require('../models/OtpVerification');
const { generateToken } = require('../utils/jwt');
const { TempTokenType } = require('../utils/jwt');
const { sendOtpEmail, validateEmailConfig } = require('./emailService');
const { sendOtpEmail: sendGridOtpEmail, sendWelcomeEmail: sendGridWelcomeEmail, sendSubscriptionPurchaseEmail: sendGridSubscriptionPurchaseEmail, validateSendGridConfig } = require('./sendGridEmailService');
const { ValidationError, AuthenticationError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');
const { getAuthProvider } = require('../utils/userAuthHelpers');

/**
 * Generate a 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Calculate expiry time based on environment variable
 * @returns {Date} - Expiry timestamp
 */
const calculateExpiryTime = () => {
  const expiresIn = process.env.OTP_EXPIRES_IN || '5m';
  const expiryTime = new Date();
  
  // Parse time units (m for minutes, h for hours, etc.)
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1));
  
  switch (unit) {
    case 'm':
      expiryTime.setMinutes(expiryTime.getMinutes() + value);
      break;
    case 'h':
      expiryTime.setHours(expiryTime.getHours() + value);
      break;
    case 'd':
      expiryTime.setDate(expiryTime.getDate() + value);
      break;
    default:
      // Default to 5 minutes if invalid format
      expiryTime.setMinutes(expiryTime.getMinutes() + 5);
  }
  
  return expiryTime;
};

/**
 * Request OTP for email verification
 * @param {string} email - User's email address
 * @param {string} language - Language code (en or de)
 * @returns {Object} - OTP request result
 */
const requestOtp = async (email, language = 'en') => {
  try {
    // Validate SendGrid email configuration
    validateSendGridConfig();

    console.log('Registration OTP request for email: ', email);

    // Check if user already exists and is NOT deleted
    const User = require('../models/User');
    const existingUser = await User.findOne({ email, IsDeleted: { $ne: true } });
    if (existingUser) {
      // Do not send OTP, throw error (only if user exists and is not deleted)
      throw new ValidationError(getLocalizedMessage('error.email.already.exists', language));
    }

    // Generate OTP and expiry time
    const otp = generateOtp();
    const expiresAt = calculateExpiryTime();

    // Invalidate any existing OTP for this email with REGISTRATION type
    await OtpVerification.updateMany(
      { email, isUsed: false, otpType: TempTokenType.REGISTRATION },
      { isUsed: true }
    );

    // Save new OTP with type identifier
    const otpVerification = new OtpVerification({
      email,
      otp,
      expiresAt,
      otpType: TempTokenType.REGISTRATION
    });

    await otpVerification.save();

    // Send OTP email using SendGrid
    await sendGridOtpEmail(email, otp, TempTokenType.REGISTRATION, language);

    return {
      message: getLocalizedMessage('otp.sent', language),
      email: email,
      expiresIn: process.env.OTP_EXPIRES_IN || '5m'
    };

  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(getLocalizedMessage('otp.failed.to.send', language));
  }
};

/**
 * Verify OTP and generate temporary token
 * @param {string} email - User's email address
 * @param {string} otp - 6-digit OTP
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Verification result with temporary token
 */
const verifyOtp = async (email, otp, language = 'en') => {
  try {
    console.log('Verify OTP request for email: ', email);
    // Find the most recent OTP for this email with REGISTRATION type
    const otpVerification = await OtpVerification.findOne({
      email,
      isUsed: false,
      otpType: TempTokenType.REGISTRATION
    }).sort({ createdAt: -1 });

    if (!otpVerification) {
      throw new AuthenticationError(getLocalizedMessage('otp.not.found', language));
    }

    // Check if OTP is valid
    if (!otpVerification.isValid()) {
      if (otpVerification.isExpired()) {
        // Delete expired OTP
        await OtpVerification.deleteOne({ _id: otpVerification._id });
        throw new AuthenticationError(getLocalizedMessage('otp.expired', language));
      }
      if (otpVerification.isUsed) {
        await OtpVerification.deleteOne({ _id: otpVerification._id });
        throw new AuthenticationError(getLocalizedMessage('otp.already.used', language));
      }
      if (otpVerification.attempts >= otpVerification.maxAttempts) {
        await OtpVerification.deleteOne({ _id: otpVerification._id });
        throw new AuthenticationError(getLocalizedMessage('otp.max.attempts', language));
      }
    }

    // Verify OTP
    if (otpVerification.otp !== otp) {
      await otpVerification.incrementAttempts();
      // If after incrementing, attempts >= maxAttempts, delete the OTP
      if (otpVerification.attempts + 1 >= otpVerification.maxAttempts) {
        await OtpVerification.deleteOne({ _id: otpVerification._id });
      }
      throw new AuthenticationError(getLocalizedMessage('otp.invalid', language));
    }

    // OTP is correct, delete it from the database
    await OtpVerification.deleteOne({ _id: otpVerification._id });

    // Generate temporary token for registration
    const tempTokenPayload = {
      email: email,
      otpVerified: true,
      type: TempTokenType.REGISTRATION
    };

    const tempToken = generateToken(tempTokenPayload, process.env.TEMP_TOKEN_EXPIRES_IN || '2m');

    return {
      message: getLocalizedMessage('otp.verified', language),
      email: email,
      tempToken: tempToken
    };

  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new Error(getLocalizedMessage('otp.verification.failed', language));
  }
};

/**
 * Request OTP for password reset
 * @param {string} email - User's email address
 * @param {string} language - Language code (en or de)
 * @returns {Object} - OTP request result (always success, do not reveal if email exists)
 */
const forgotPasswordOtp = async (email, language = 'en') => {
  try {
    validateSendGridConfig();
    const User = require('../models/User');
    // Check if user exists and is NOT deleted
    const existingUser = await User.findOne({ email, IsDeleted: { $ne: true } });
    // Always return success, do not reveal if email exists or if user is deleted
    if (!existingUser) {
      return {
        message: getLocalizedMessage('otp.if.email.exists', language),
        email,
        expiresIn: process.env.OTP_EXPIRES_IN || '5m',
        passwordResetSent: false,
        authProvider: null
      };
    }

    const authProvider = getAuthProvider(existingUser);
    if (authProvider === 'google' || authProvider === 'apple') {
      const messageKey =
        authProvider === 'google'
          ? 'auth.forgot.password.use.google'
          : 'auth.forgot.password.use.apple';
      return {
        message: getLocalizedMessage(messageKey, language),
        email,
        expiresIn: null,
        passwordResetSent: false,
        authProvider
      };
    }

    // Generate OTP and expiry time
    const otp = generateOtp();
    const expiresAt = calculateExpiryTime();
    // Invalidate any existing OTP for this email with RESET_PASSWORD type
    await OtpVerification.updateMany(
      { email, isUsed: false, otpType: TempTokenType.RESET_PASSWORD },
      { isUsed: true }
    );
    // Save new OTP with type identifier
    const otpVerification = new OtpVerification({
      email,
      otp,
      expiresAt,
      otpType: TempTokenType.RESET_PASSWORD
    });
    await otpVerification.save();
    // Send OTP email using SendGrid
    await sendGridOtpEmail(email, otp, TempTokenType.RESET_PASSWORD, language);
    return {
      message: getLocalizedMessage('otp.if.email.exists', language),
      email,
      expiresIn: process.env.OTP_EXPIRES_IN || '5m',
      passwordResetSent: true,
      authProvider: 'email'
    };
  } catch (error) {
    // Always return success for security
    return {
      message: getLocalizedMessage('otp.if.email.exists', language),
      email,
      expiresIn: process.env.OTP_EXPIRES_IN || '5m',
      passwordResetSent: false,
      authProvider: null
    };
  }
};

/**
 * Verify OTP for password reset and generate temporary token
 * @param {string} email - User's email address
 * @param {string} otp - 6-digit OTP
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Verification result with temporary token (type: reset-password)
 */
const verifyResetOtp = async (email, otp, language = 'en') => {
  try {
    // Find the most recent OTP for this email with RESET_PASSWORD type
    const otpVerification = await OtpVerification.findOne({
      email,
      isUsed: false,
      otpType: TempTokenType.RESET_PASSWORD
    }).sort({ createdAt: -1 });
    if (!otpVerification) {
      throw new AuthenticationError(getLocalizedMessage('otp.not.found', language));
    }
    // Check if OTP is valid
    if (!otpVerification.isValid()) {
      if (otpVerification.isExpired()) {
        await OtpVerification.deleteOne({ _id: otpVerification._id });
        throw new AuthenticationError(getLocalizedMessage('otp.expired', language));
      }
      if (otpVerification.isUsed) {
        await OtpVerification.deleteOne({ _id: otpVerification._id });
        throw new AuthenticationError(getLocalizedMessage('otp.already.used', language));
      }
      if (otpVerification.attempts >= otpVerification.maxAttempts) {
        await OtpVerification.deleteOne({ _id: otpVerification._id });
        throw new AuthenticationError(getLocalizedMessage('otp.max.attempts', language));
      }
    }
    // Verify OTP
    if (otpVerification.otp !== otp) {
      await otpVerification.incrementAttempts();
      if (otpVerification.attempts + 1 >= otpVerification.maxAttempts) {
        await OtpVerification.deleteOne({ _id: otpVerification._id });
      }
      throw new AuthenticationError(getLocalizedMessage('otp.invalid', language));
    }
    // OTP is correct, delete it from the database
    await OtpVerification.deleteOne({ _id: otpVerification._id });
    // Generate temporary token for password reset
    const tempTokenPayload = {
      email: email,
      otpVerified: true,
      type: TempTokenType.RESET_PASSWORD
    };
    const tempToken = generateToken(tempTokenPayload, process.env.TEMP_TOKEN_EXPIRES_IN || '2m');
    return {
      message: getLocalizedMessage('otp.verified', language),
      email: email,
      tempToken: tempToken
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new Error(getLocalizedMessage('otp.verification.failed', language));
  }
};

/**
 * Send welcome email after successful registration
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} language - Language code (en or de)
 * @returns {Promise<void>}
 */
const sendWelcomeEmail = async (email, name, language = 'en') => {
  try {
    // Validate SendGrid email configuration
    validateSendGridConfig();

    // Send welcome email using SendGrid
    await sendGridWelcomeEmail(email, name, language);

    console.log(`Welcome email sent successfully to ${email}`);

  } catch (error) {
    // Log error but don't throw - we don't want registration to fail if email fails
    console.error('Error sending welcome email:', error);
    // Don't throw error to avoid breaking registration flow
  }
};

/** TODO: we will implement this again after AIAP and GPB
 * Send subscription purchase confirmation email
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} defaultLanguage - Default language code (en or de) if user preference not found
 * @returns {Promise<void>}
 */
/*
const sendSubscriptionPurchaseEmail = async (subscriptionId, defaultLanguage = 'en') => {
  try {
    // Validate SendGrid email configuration
    validateSendGridConfig();

    // Get subscription from database
    const Subscription = require('../models/Subscription');
    const SubscriptionPlan = require('../models/SubscriptionPlan');
    const User = require('../models/User');

    const subscription = await Subscription.findOne({ 
      stripeSubscriptionId: subscriptionId 
    }).populate('userId');

    if (!subscription) {
      console.error(`Subscription not found for subscriptionId: ${subscriptionId}`);
      return;
    }

    // Get user information
    const user = await User.findById(subscription.userId);
    if (!user || !user.email || !user.name) {
      console.error(`User not found or missing email/name for subscription: ${subscriptionId}`);
      return;
    }

    // Get user's language preference from user.settings.language and convert to language code
    let language = defaultLanguage;
    if (user.settings && user.settings.language) {
      const userLang = user.settings.language.toLowerCase();
      console.log(`User language preference: ${userLang}`);
      if (userLang === 'german' || userLang === 'de' || userLang === 'deutsch') {
        language = 'de';
      } else {
        language = 'en';
      }
    }

    // Get subscription plan using priceId
    let planName = 'Impact'; // Default fallback
    if (subscription.priceId) {
      const subscriptionPlan = await SubscriptionPlan.findOne({ 
        stripePriceId: subscription.priceId 
      });
      
      if (subscriptionPlan && subscriptionPlan.name) {
        planName = subscriptionPlan.name;
      }
    }

    // Send subscription purchase email using SendGrid
    await sendGridSubscriptionPurchaseEmail(user.email, user.name, planName, language);

    console.log(`Subscription purchase email sent successfully to ${user.email} for plan: ${planName} in ${language}`);

  } catch (error) {
    // Log error but don't throw - we don't want webhook processing to fail if email fails
    console.error('Error sending subscription purchase email:', error);
    // Don't throw error to avoid breaking webhook processing
  }
};
*/

module.exports = {
  requestOtp,
  verifyOtp,
  forgotPasswordOtp,
  verifyResetOtp,
  sendWelcomeEmail //,
  //sendSubscriptionPurchaseEmail
}; 