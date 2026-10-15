/**
 * Language middleware to extract language from request headers
 * Supports Accept-Language header with fallback to English
 */

const SUPPORTED_LANGUAGES = {
  'en': 'en',
  'english': 'en',
  'de': 'de',
  'german': 'de'
};

const DEFAULT_LANGUAGE = 'en';

/**
 * Extract language from Accept-Language header
 * @param {string} acceptLanguage - Accept-Language header value
 * @returns {string} Language code (en or de)
 */
const extractLanguageFromHeader = (acceptLanguage) => {
  if (!acceptLanguage) {
    return DEFAULT_LANGUAGE;
  }

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,de;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      // Extract language code (remove quality values and country codes)
      const langCode = lang.split(';')[0].trim().toLowerCase().split('-')[0];
      return langCode;
    });

  // Find first supported language
  for (const lang of languages) {
    if (SUPPORTED_LANGUAGES[lang]) {
      return SUPPORTED_LANGUAGES[lang];
    }
  }

  // Fallback to default language
  return DEFAULT_LANGUAGE;
};

/**
 * Language middleware function
 * Adds req.language property to request object
 */
const languageMiddleware = (req, res, next) => {
  try {
    const acceptLanguage = req.headers['accept-language'];
    const language = extractLanguageFromHeader(acceptLanguage);
    
    // Add language to request object
    req.language = language;
    
    // Optional: Add language to response headers for client reference
    res.setHeader('Content-Language', language);
    
    next();
  } catch (error) {
    // If language detection fails, use default language
    req.language = DEFAULT_LANGUAGE;
    res.setHeader('Content-Language', DEFAULT_LANGUAGE);
    next();
  }
};

module.exports = {
  languageMiddleware,
  extractLanguageFromHeader,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
