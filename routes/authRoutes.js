const express = require('express');
const router = express.Router();
const { requestOtp, verifyOtp, registerUser, registerUserV1, loginUser, ssoLogin, ssoSignup, ssoSignupV1, forgotPassword, verifyResetOtp, resetPassword, validatePassword } = require('../controllers/authController');

// Request OTP for email verification
router.post('/request-otp', requestOtp);

// Verify OTP and get temporary token
router.post('/verify-otp', verifyOtp);

// Register user with OTP verification
router.post('/register', registerUser);

// Register user v1 (no personalization)
router.post('/v1/register', registerUserV1);

// Login user
router.post('/login', loginUser);

// SSO login (Google / Apple) — existing active users only
router.post('/sso/login', ssoLogin);

// SSO signup (Google / Apple) — new users or reactivate deleted
router.post('/sso/signup', ssoSignup);

// SSO signup v1 (no personalization, no calculateCycle)
router.post('/sso/v1/signup', ssoSignupV1);

// Legacy alias: same as /sso/login
router.post('/sso', ssoLogin);

// Forgot password (request OTP for password reset)
router.post('/forgot-password', forgotPassword);

// Verify OTP for password reset
router.post('/verify-reset-otp', verifyResetOtp);

// Reset password
router.post('/reset-password', resetPassword);

// Validate password strength
router.post('/validate-password', validatePassword);

module.exports = router; 