const otpService = require('../services/otpService');
const userService = require('../services/userService');
const ssoService = require('../services/ssoService');
const menstrualCycleService = require('../services/menstrualCycleService');
const { getLocalizedMessageFromRequest } = require('../utils/localization');

// @desc    Request OTP for email verification
// @route   POST /api/auth/request-otp
// @access  Public
const requestOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.email.required', req)
      });
    }

    const result = await otpService.requestOtp(email, req.language || 'en');

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        expiresIn: result.expiresIn
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and get temporary token
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res, next) => {
  try {
    console.log('Verify OTP request for email: ', req.body);
    const email = req.body.email?.trim();
    const otp = req.body.otp?.trim();

    console.log('OTP and Email are trimmed', email);

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.email.otp.required', req)
      });
    }

    const result = await otpService.verifyOtp(email, otp, req.language || 'en');

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        tempToken: result.tempToken
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Register user with OTP verification (v1 — no personalization)
// @route   POST /api/auth/v1/register
// @access  Public
const registerUserV1 = async (req, res, next) => {
  try {
    const userData = req.body;

    const result = await userService.registerUserV1(userData, req.language || 'en');

    if (result.user && result.user.email && result.user.name) {
      await otpService.sendWelcomeEmail(result.user.email, result.user.name, req.language || 'en');
    }

    res.status(201).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.registered', req),
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register user with OTP verification
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    const userData = req.body;

    const result = await userService.registerUser(userData, req.language || 'en');

    // Send welcome email after successful registration
    if (result.user && result.user.email && result.user.name) {
      await otpService.sendWelcomeEmail(result.user.email, result.user.name, req.language || 'en');
    }

    res.status(201).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.registered', req),
      data: result
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const loginData = req.body;
    const result = await userService.loginUser(loginData, req.language || 'en');

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.login.successful', req),
      data: result
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Request OTP for password reset
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: getLocalizedMessageFromRequest('error.email.required', req) });
    }
    const result = await otpService.forgotPasswordOtp(email, req.language || 'en');
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        expiresIn: result.expiresIn,
        passwordResetSent: result.passwordResetSent === true,
        authProvider: result.authProvider ?? null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP for password reset
// @route   POST /api/auth/verify-reset-otp
// @access  Public
const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: getLocalizedMessageFromRequest('error.email.otp.required', req) });
    }
    const result = await otpService.verifyResetOtp(email, otp, req.language || 'en');
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        tempToken: result.tempToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using tempToken
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, tempToken } = req.body;
    const result = await userService.resetPassword(email, newPassword, tempToken, req.language || 'en');
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate password strength (regex: length, letter, number, allowed chars)
// @route   POST /api/auth/validate-password
// @access  Public
const validatePassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (password === undefined || password === null) {
      return res.status(400).json({
        success: false,
        message: getLocalizedMessageFromRequest('error.password.required', req),
        data: { valid: false, message: 'Password is required' }
      });
    }

    const result = userService.validatePasswordStrength(password);

    res.status(200).json({
      success: true,
      data: {
        valid: result.valid,
        message: result.message
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    SSO login (existing active users only)
// @route   POST /api/auth/sso/login
// @access  Public
const ssoLogin = async (req, res, next) => {
  try {
    const { provider, idToken } = req.body;
    const result = await ssoService.ssoLogin(
      { provider, idToken },
      req.language || 'en'
    );

    if (result.isProfileComplete) {
      console.log('calculateCycle starting for userId', result.user._id);

      menstrualCycleService.calculateCycle(result.user._id);

      console.log('calculateCycle completed for userId', result.user._id);
    }

    res.status(200).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.login.successful', req),
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    SSO signup v1 (new users or reactivate deleted; no personalization, no calculateCycle)
// @route   POST /api/auth/sso/v1/signup
// @access  Public
const ssoSignupV1 = async (req, res, next) => {
  try {
    const { provider, idToken, name, email } = req.body;
    console.log('ssoSignupV1 called');
    console.log('name', name);
    console.log('email', email);
    const result = await ssoService.ssoSignupV1(
      { provider, idToken, name, email },
      req.language || 'en'
    );

    if (result?.user?._id && result.user.email) {
      await otpService.sendWelcomeEmail(result.user.email, result.user.name, req.language || 'en');
    }

    res.status(201).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.registered', req),
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    SSO signup (new users or reactivate deleted; includes personalization)
// @route   POST /api/auth/sso/signup
// @access  Public
const ssoSignup = async (req, res, next) => {
  try {
    const { provider, idToken, personalization, name, email } = req.body;
    const result = await ssoService.ssoSignup(
      { provider, idToken, personalization, name, email },
      req.language || 'en'
    );

    // Only run post-signup side-effects when ssoService actually created/reactivated a user.
    // If the service threw, the catch block already short-circuits this; this guard handles any
    // edge case where the service resolves without a fully-formed user.
    if (result?.user?._id) {
      console.log('calculateCycle starting for userId', result.user._id);

      menstrualCycleService.calculateCycle(result.user._id);

      console.log('calculateCycle completed for userId', result.user._id);

      // Send welcome email after successful registration. Name may be
      // absent for Apple SSO users (Apple doesn't expose fullName after the
      // first sign-in); sendWelcomeEmail handles the no-name greeting.
      if (result.user.email) {
        await otpService.sendWelcomeEmail(result.user.email, result.user.name, req.language || 'en');
      }
    }

    res.status(201).json({
      success: true,
      message: getLocalizedMessageFromRequest('user.registered', req),
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestOtp,
  verifyOtp,
  registerUser,
  registerUserV1,
  loginUser,
  ssoLogin,
  ssoSignup,
  ssoSignupV1,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  validatePassword,
}; 


