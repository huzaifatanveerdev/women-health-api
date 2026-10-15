// Email validation regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password validation: allowed characters only (letters, digits, @$!%*?&)
//const passwordAllowedCharsRegex = /^[A-Za-z\d@$!%*?&]*$/;
const passwordAllowedCharsRegex = /^[A-Za-z\d@$!%*?&]{8,}$/;
/**
 * Validates email format using regex
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email is valid, false otherwise
 */
const isValidEmail = (email) => {
  return emailRegex.test(email);
};

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} - Object with isValid boolean and error message if invalid
 */
const validatePassword = (password) => {
  if (password.length < 8) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long'
    };
  }

  if (!passwordAllowedCharsRegex.test(password)) {
    return {
      isValid: false,
      message: 'Password can only contain letters, numbers, and these special characters: @ $ ! % * ? &'
    };
  }

  if (!/[A-Za-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one letter'
    };
  }

  if (!/\d/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number'
    };
  }

  return {
    isValid: true,
    message: null
  };
};

module.exports = {
  emailRegex,
  passwordAllowedCharsRegex,
  isValidEmail,
  validatePassword
}; 