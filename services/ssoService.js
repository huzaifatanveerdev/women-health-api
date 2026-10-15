const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { getLocalizedMessage } = require('../utils/localization');
const {
  getAuthProvider,
  buildAuthResponse,
  validatePersonalizationPayload,
  buildPersonalizationData
} = require('../utils/userAuthHelpers');
const {
  ValidationError,
  AuthenticationError,
  DatabaseError
} = require('../utils/errors');

const appleJwksClient = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  rateLimit: true
});

const getGoogleAudiences = () => {
  const ids = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_IOS,
    process.env.GOOGLE_CLIENT_ID_ANDROID
  ].filter(Boolean);
  return [...new Set(ids)];
};

const verifyGoogleToken = async (idToken, language) => {
  const audiences = getGoogleAudiences();
  if (audiences.length === 0) {
    throw new DatabaseError(getLocalizedMessage('auth.sso.not.configured', language));
  }
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new AuthenticationError(getLocalizedMessage('auth.sso.invalid.token', language));
  }
  return {
    sub: payload.sub,
    email: payload.email ? payload.email.toLowerCase().trim() : null,
    name: payload.name || payload.given_name || 'User'
  };
};

const getAppleSigningKey = (header, callback) => {
  appleJwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, key.getPublicKey());
  });
};

const verifyAppleToken = async (idToken, language) => {
  const bundleId = process.env.APPLE_BUNDLE_ID;
  if (!bundleId) {
    throw new DatabaseError(getLocalizedMessage('auth.sso.not.configured', language));
  }
  const decoded = await new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getAppleSigningKey,
      {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: bundleId
      },
      (err, payload) => {
        if (err) {
          reject(err);
        } else {
          resolve(payload);
        }
      }
    );
  });
  if (!decoded?.sub) {
    throw new AuthenticationError(getLocalizedMessage('auth.sso.invalid.token', language));
  }
  // Apple's identityToken intentionally does NOT carry the user's name.
  // The name is only delivered to the native client on the FIRST sign-in
  // (and never again, even after reinstall) — frontend must forward it.
  return {
    sub: decoded.sub,
    email: decoded.email ? decoded.email.toLowerCase().trim() : null,
    name: null
  };
};

// Sanitize a client-supplied name. Trims, strips control chars, length-caps
// so we never persist arbitrary blobs into User.name.
const sanitizeClientName = (value) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 100);
};

const sanitizeClientEmail = (value) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return null;
  return cleaned;
};

// Apply unverified hints from the request body onto the verified identity.
// Only fills in fields that the provider token did NOT supply, so
// JWKS-signed values from Google/Apple always win over client input.
// If name remains empty after merging hints (typical Apple second sign-in),
// it stays empty — User.name is now optional and downstream save helpers
// skip the field entirely instead of persisting a placeholder.
const applyClientIdentityHints = (identity, hints) => {
  if (hints && typeof hints === 'object') {
    if (!identity.email) {
      const hintedEmail = sanitizeClientEmail(hints.email);
      if (hintedEmail) {
        identity.email = hintedEmail;
      }
    }
    if (!identity.name) {
      const hintedName = sanitizeClientName(hints.name);
      if (hintedName) {
        identity.name = hintedName;
      }
    }
  }
  return identity;
};

const verifyProviderToken = async (provider, idToken, language) => {
  if (provider === 'google') {
    return verifyGoogleToken(idToken, language);
  }
  if (provider === 'apple') {
    return verifyAppleToken(idToken, language);
  }
  throw new ValidationError(getLocalizedMessage('auth.sso.invalid.provider', language));
};

const validateSsoRequest = (provider, idToken, language) => {
  if (!provider || !idToken) {
    throw new ValidationError(getLocalizedMessage('auth.sso.missing.fields', language));
  }
  if (!['google', 'apple'].includes(provider)) {
    throw new ValidationError(getLocalizedMessage('auth.sso.invalid.provider', language));
  }
};

const verifyIdentity = async (provider, idToken, language) => {
  try {
    return await verifyProviderToken(provider, idToken, language);
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof AuthenticationError ||
      error instanceof DatabaseError
    ) {
      throw error;
    }
    throw new AuthenticationError(getLocalizedMessage('auth.sso.invalid.token', language));
  }
};

const assertNoProviderConflict = (activeUser, provider, language) => {
  const existingProvider = getAuthProvider(activeUser);
  if (existingProvider === provider) {
    return;
  }
  if (existingProvider === 'email') {
    throw new AuthenticationError(getLocalizedMessage('auth.sso.email.account.exists', language));
  }
  throw new AuthenticationError(getLocalizedMessage('auth.sso.provider.account.exists', language));
};

const findActiveUser = async (provider, sub, email) => {
  const subQuery = provider === 'google' ? { googleSub: sub } : { appleSub: sub };
  const bySub = await User.findOne({ ...subQuery, IsDeleted: { $ne: true } });
  if (bySub) {
    return bySub;
  }
  if (email) {
    return User.findOne({ email, IsDeleted: { $ne: true } });
  }
  return null;
};

const findDeletedUser = async (provider, sub, email) => {
  const subQuery = provider === 'google' ? { googleSub: sub } : { appleSub: sub };
  const bySub = await User.findOne({ ...subQuery, IsDeleted: true });
  if (bySub) {
    return bySub;
  }
  if (email) {
    return User.findOne({ email, IsDeleted: true });
  }
  return null;
};

const resolveIdentityEmailForLogin = async (provider, identity, language) => {
  if (identity.email) {
    return identity;
  }
  const bySub = await User.findOne({
    ...(provider === 'google' ? { googleSub: identity.sub } : { appleSub: identity.sub }),
    IsDeleted: { $ne: true }
  });
  if (!bySub) {
    throw new AuthenticationError(getLocalizedMessage('auth.sso.user.not.found', language));
  }
  identity.email = bySub.email;
  if (!identity.name && bySub.name) {
    identity.name = bySub.name;
  }
  return identity;
};

const buildDefaultSettings = (language) => ({
  periodStartReminder: false,
  cycleInsightWeekly: false,
  language
});

const buildSsoSignupSetFields = (provider, identity, settingsData, personalizationData) => {
  const now = new Date();
  const setFields = {
    authProvider: provider,
    settings: settingsData,
    personalization: personalizationData,
    dob: null,
    createdAt: now,
    updatedAt: now,
    IsDeleted: false,
    DeletedAt: null
  };
  // Only overwrite name when we have a real one — preserves any prior
  // name on a soft-deleted user being reactivated.
  if (identity.name) {
    setFields.name = identity.name;
  }
  if (identity.email) {
    setFields.email = identity.email;
  }
  if (provider === 'google') {
    setFields.googleSub = identity.sub;
  } else {
    setFields.appleSub = identity.sub;
  }
  return setFields;
};

const buildSsoSignupUnsetFields = (provider) => {
  const unset = {
    password: 1,
    phone: 1,
    gender: 1,
    profilePicture: 1
  };
  if (provider === 'google') {
    unset.appleSub = 1;
  } else {
    unset.googleSub = 1;
  }
  return unset;
};

const issueAuthForUser = (user) => {
  const token = generateToken({
    userId: user._id,
    email: user.email,
    name: user.name
  });
  return buildAuthResponse(user, token);
};

const handleSignupPersistenceError = (error, language) => {
  if (error.code === 11000) {
    throw new AuthenticationError(getLocalizedMessage('auth.sso.account.exists.try.login', language));
  }
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map((err) => err.message);
    throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
  }
  throw new DatabaseError(getLocalizedMessage('failed.create.user', language));
};

/**
 * SSO login only — existing active users. No create, no reactivate.
 */
const ssoLogin = async ({ provider, idToken }, language = 'en') => {
  validateSsoRequest(provider, idToken, language);
  let identity = await verifyIdentity(provider, idToken, language);
  identity = await resolveIdentityEmailForLogin(provider, identity, language);

  console.log('ssoLogin called with identity.email', identity.email);

  const activeUser = await findActiveUser(provider, identity.sub, identity.email);
  if (!activeUser) {
    console.log('active user not found for provider', provider, 'and email', identity.email);
    // Deleted accounts get the same response as unknown email (no account disclosure)
    throw new AuthenticationError(getLocalizedMessage('auth.sso.user.not.found', language));
  }

  console.log('active user found for provider', provider, 'and email', identity.email);


  assertNoProviderConflict(activeUser, provider, language);
  return issueAuthForUser(activeUser);
};

/**
 * SSO signup only — create new or reactivate deleted. No login for existing active users.
 */
const ssoSignup = async ({ provider, idToken, personalization, name, email }, language = 'en') => {
  validateSsoRequest(provider, idToken, language);

  const personalizationValidation = validatePersonalizationPayload(
    personalization,
    language,
    getLocalizedMessage
  );
  if (!personalizationValidation.valid) {
    throw new ValidationError(
      personalizationValidation.message,
      personalizationValidation.missingFields.map((field) =>
        getLocalizedMessage('registration.field.required', language, { field })
      )
    );
  }

  const identity = await verifyIdentity(provider, idToken, language);
  applyClientIdentityHints(identity, { name, email });
  const settingsData = buildDefaultSettings(language);
  const personalizationData = buildPersonalizationData(personalization);

  console.log('ssoSignup called with identity.email', identity.email);

  const activeUser = await findActiveUser(provider, identity.sub, identity.email);
  if (activeUser) {
    console.log('active user found for provider', provider, 'and email', identity.email);
    throw new AuthenticationError(getLocalizedMessage('auth.sso.account.exists.try.login', language));
  }

  console.log('active user not found for provider', provider, 'and email', identity.email);

  const deletedUser = await findDeletedUser(provider, identity.sub, identity.email);
  if (deletedUser) {
    console.log('deleted user found for provider', provider, 'and email', identity.email);
    try {
      const reactivated = await User.findByIdAndUpdate(
        deletedUser._id,
        {
          $set: buildSsoSignupSetFields(provider, identity, settingsData, personalizationData),
          $unset: buildSsoSignupUnsetFields(provider)
        },
        { new: true, runValidators: true, select: '-password' }
      );
      return issueAuthForUser(reactivated);
    } catch (error) {
      handleSignupPersistenceError(error, language);
    }
  }

  if (!identity.email) {
    throw new AuthenticationError(getLocalizedMessage('auth.sso.email.required', language));
  }

  try {
    const userObject = {
      email: identity.email,
      authProvider: provider,
      settings: settingsData,
      personalization: personalizationData
    };
    if (identity.name) {
      userObject.name = identity.name;
    }
    if (provider === 'google') {
      userObject.googleSub = identity.sub;
    } else {
      userObject.appleSub = identity.sub;
    }
    const user = new User(userObject);
    const savedUser = await user.save();
    return issueAuthForUser(savedUser);
  } catch (error) {
    handleSignupPersistenceError(error, language);
  }
};

const buildSsoSignupSetFieldsV1 = (provider, identity, settingsData) => {
  const now = new Date();
  const setFields = {
    authProvider: provider,
    settings: settingsData,
    dob: null,
    createdAt: now,
    updatedAt: now,
    IsDeleted: false,
    DeletedAt: null
  };
  // Only overwrite name when we have a real one — preserves any prior
  // name on a soft-deleted user being reactivated.
  if (identity.name) {
    setFields.name = identity.name;
  }
  if (identity.email) {
    setFields.email = identity.email;
  }
  if (provider === 'google') {
    setFields.googleSub = identity.sub;
  } else {
    setFields.appleSub = identity.sub;
  }
  return setFields;
};

const buildSsoSignupUnsetFieldsV1 = (provider) => ({
  ...buildSsoSignupUnsetFields(provider),
  personalization: 1
});

/**
 * SSO signup v1 — create new or reactivate deleted without personalization.
 */
const ssoSignupV1 = async ({ provider, idToken, name, email }, language = 'en') => {
  validateSsoRequest(provider, idToken, language);

  const identity = await verifyIdentity(provider, idToken, language);
  applyClientIdentityHints(identity, { name, email });
  const settingsData = buildDefaultSettings(language);

  console.log('ssoSignupV1 called with identity.email', identity.email);

  const activeUser = await findActiveUser(provider, identity.sub, identity.email);
  if (activeUser) {
    console.log('active user found for provider', provider, 'and email', identity.email);
    throw new AuthenticationError(getLocalizedMessage('auth.sso.account.exists.try.login', language));
  }

  console.log('active user not found for provider', provider, 'and email', identity.email);

  const deletedUser = await findDeletedUser(provider, identity.sub, identity.email);
  if (deletedUser) {
    console.log('deleted user found for provider', provider, 'and email', identity.email);
    try {
      const reactivated = await User.findByIdAndUpdate(
        deletedUser._id,
        {
          $set: buildSsoSignupSetFieldsV1(provider, identity, settingsData),
          $unset: buildSsoSignupUnsetFieldsV1(provider)
        },
        { new: true, runValidators: true, select: '-password' }
      );
      return issueAuthForUser(reactivated);
    } catch (error) {
      handleSignupPersistenceError(error, language);
    }
  }

  if (!identity.email) {
    throw new AuthenticationError(getLocalizedMessage('auth.sso.email.required', language));
  }

  try {
    const userObject = {
      email: identity.email,
      authProvider: provider,
      settings: settingsData
    };
    if (identity.name) {
      userObject.name = identity.name;
    }
    if (provider === 'google') {
      userObject.googleSub = identity.sub;
    } else {
      userObject.appleSub = identity.sub;
    }
    const user = new User(userObject);
    const savedUser = await user.save();
    return issueAuthForUser(savedUser);
  } catch (error) {
    handleSignupPersistenceError(error, language);
  }
};

module.exports = {
  ssoLogin,
  ssoSignup,
  ssoSignupV1
};
