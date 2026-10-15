/**
 * Timezone utility functions for handling user local time
 */

/**
 * Get common timezone options
 * @returns {Array} Array of timezone objects
 */
const getCommonTimezones = () => {
  return [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' }
  ];
};

/**
 * Validate if a timezone string is valid
 * @param {string} timezone - Timezone string to validate
 * @returns {boolean} True if valid, false otherwise
 */
const isValidTimezone = (timezone) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get current time in a specific timezone
 * @param {string} timezone - Timezone string
 * @returns {Date} Current time in the specified timezone
 */
const getCurrentTimeInTimezone = (timezone = 'UTC') => {
  try {
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    return new Date();
  }
};

/**
 * Format date for display in a specific timezone
 * @param {Date} date - Date to format
 * @param {string} timezone - Timezone string
 * @param {string} locale - Locale string (default: 'en-US')
 * @returns {string} Formatted date string
 */
const formatDateInTimezone = (date, timezone = 'UTC', locale = 'en-US') => {
  try {
    return date.toLocaleString(locale, { 
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    // Fallback to UTC formatting
    return date.toLocaleString(locale, { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
};

module.exports = {
  getCommonTimezones,
  isValidTimezone,
  getCurrentTimeInTimezone,
  formatDateInTimezone
};
