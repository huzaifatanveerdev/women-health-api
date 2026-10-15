const nodemailer = require('nodemailer');

/**
 * Create email transporter
 * @returns {Object} - Nodemailer transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send OTP email
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP
 * @param {string} otpType - Type of OTP ('registration' or 'reset-password')
 * @returns {Promise} - Email sending result
 */
const sendOtpEmail = async (email, otp, otpType = 'registration') => {
  try {
    const transporter = createTransporter();

    let subject, html;
    if (otpType === 'reset-password') {
      subject = 'Password Reset OTP - women-help-api';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #666; margin-bottom: 20px;">
              You have requested to reset your password for women-help-api. Please use the following OTP to proceed:
            </p>
            <div style="background-color: #dc3545; color: white; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
              This OTP is valid for ${process.env.OTP_EXPIRES_IN || '5 minutes'}.
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
              If you did not request a password reset, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
              This is an automated email. Please do not reply to this message.
            </p>
          </div>
        </div>
      `;
    } else {
      subject = 'Email Verification OTP - women-help-api';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>
            <p style="color: #666; margin-bottom: 20px;">
              Thank you for registering with women-help-api. Please use the following OTP to verify your email address:
            </p>
            <div style="background-color: #007bff; color: white; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
              This OTP is valid for ${process.env.OTP_EXPIRES_IN || '5 minutes'}.
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
              If you didn't request this verification, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
              This is an automated email. Please do not reply to this message.
            </p>
          </div>
        </div>
      `;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully:', result.messageId);
    return result;

  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

/**
 * Validate email configuration
 * @returns {boolean} - True if configuration is valid
 */
const validateEmailConfig = () => {
  const requiredFields = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM'];
  const missingFields = requiredFields.filter(field => !process.env[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing email configuration: ${missingFields.join(', ')}`);
  }
  
  return true;
};

module.exports = {
  sendOtpEmail,
  validateEmailConfig
}; 