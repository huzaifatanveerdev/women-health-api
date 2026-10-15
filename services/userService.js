const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { isValidEmail, validatePassword } = require('../utils/validators');
const { ValidationError, UserExistsError, DatabaseError, AuthenticationError } = require('../utils/errors');
const { generateToken } = require('../utils/jwt');
const { validateTempToken, TempTokenType } = require('../utils/jwt');
const CloudinaryService = require('./cloudinaryService');
const DailySymptom = require('../models/DailySymptom');
const MenstrualCycle = require('../models/MenstrualCycle');
const moment = require('moment-timezone');
const { getLocalizedMessage } = require('../utils/localization');
const {
  getAuthProvider,
  validatePersonalizationPayload,
  buildPersonalizationData,
  buildAuthResponse,
  deriveIsProfileComplete,
  isPersonalizationFieldPresent,
  REQUIRED_PERSONALIZATION_FIELDS
} = require('../utils/userAuthHelpers');

/**
 * Register a new user with validation and password hashing
 * @param {Object} userData - User registration data
 * @param {string} tempToken - Temporary token from OTP verification
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Created user data (password excluded)
 */
const registerUser = async (userData, language = 'en') => {
  const { 
    name, 
    email, 
    password, 
    confirmPassword,  
    personalization,
    tempToken
  } = userData;

  // Validate temporary token
  if (!tempToken) {
    throw new AuthenticationError(getLocalizedMessage('token.required', language));
  }

  const tokenPayload = validateTempToken(tempToken, TempTokenType.REGISTRATION);
  
  // Ensure email in token matches registration email
  if (tokenPayload.email !== email) {
    throw new AuthenticationError(getLocalizedMessage('token.email.mismatch', language));
  }

  // Validate required fields
  const requiredFields = ['name', 'email', 'password', 'confirmPassword'];
  const missingFields = requiredFields.filter(field => !userData[field]);
  
  if (missingFields.length > 0) {
    throw new ValidationError(
      getLocalizedMessage('registration.missing.fields', language),
      missingFields.map(field => getLocalizedMessage('registration.field.required', language, { field }))
    );
  }

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

  // Email validation
  if (!isValidEmail(email)) {
    throw new ValidationError(getLocalizedMessage('error.email.invalid', language));
  }

  // Password confirmation validation
  if (password !== confirmPassword) {
    throw new ValidationError(getLocalizedMessage('registration.password.mismatch', language));
  }

  // Password strength validation
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new ValidationError(passwordValidation.message);
  }

  // Check if user already exists (only non-deleted users)
  const existingUser = await User.findOne({ email, IsDeleted: { $ne: true } });
  if (existingUser) {
    if (getAuthProvider(existingUser) !== 'email') {
      throw new AuthenticationError(getLocalizedMessage('auth.sso.provider.account.exists', language));
    }
    throw new UserExistsError();
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const personalizationData = buildPersonalizationData(personalization);

  const settingsData = {
    periodStartReminder: false,
    cycleInsightWeekly: false,
    language: language
  };

  // Re-activate deleted user if email exists with IsDeleted = true
  const deletedUser = await User.findOne({ email: email.toLowerCase(), IsDeleted: true });
  if (deletedUser) {
    try {
      const now = new Date();
      const reactivatedUser = await User.findByIdAndUpdate(
        deletedUser._id,
        {
          $set: {
            name,
            password: hashedPassword,
            authProvider: 'email',
            personalization: personalizationData,
            settings: settingsData,
            dob: null,
            createdAt: now,
            updatedAt: now,
            IsDeleted: false,
            DeletedAt: null
          },
          $unset: {
            phone: 1,
            gender: 1,
            profilePicture: 1,
            googleSub: 1,
            appleSub: 1
          }
        },
        { new: true, runValidators: true, select: '-password' }
      );

      const tokenPayload = {
        userId: reactivatedUser._id,
        email: reactivatedUser.email,
        name: reactivatedUser.name
      };
      return buildAuthResponse(reactivatedUser, generateToken(tokenPayload));
    } catch (error) {
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
      }
      throw new DatabaseError(getLocalizedMessage('failed.create.user', language));
    }
  }

  // Create new user
  const userObject = {
    name,
    email,
    password: hashedPassword,
    authProvider: 'email',
    personalization: personalizationData,
    settings: settingsData
  };

  try {
    const user = new User(userObject);
    const savedUser = await user.save();

    const tokenPayload = {
      userId: savedUser._id,
      email: savedUser.email,
      name: savedUser.name
    };
    return buildAuthResponse(savedUser, generateToken(tokenPayload));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
    }
    throw new DatabaseError(getLocalizedMessage('failed.create.user', language));
  }
};

/**
 * Register a new user (v1) — same as registerUser but without personalization.
 */
const registerUserV1 = async (userData, language = 'en') => {
  const {
    name,
    email,
    password,
    confirmPassword,
    tempToken
  } = userData;

  if (!tempToken) {
    throw new AuthenticationError(getLocalizedMessage('token.required', language));
  }

  const tokenPayload = validateTempToken(tempToken, TempTokenType.REGISTRATION);

  if (tokenPayload.email !== email) {
    throw new AuthenticationError(getLocalizedMessage('token.email.mismatch', language));
  }

  const requiredFields = ['name', 'email', 'password', 'confirmPassword'];
  const missingFields = requiredFields.filter(field => !userData[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      getLocalizedMessage('registration.missing.fields', language),
      missingFields.map(field => getLocalizedMessage('registration.field.required', language, { field }))
    );
  }

  if (!isValidEmail(email)) {
    throw new ValidationError(getLocalizedMessage('error.email.invalid', language));
  }

  if (password !== confirmPassword) {
    throw new ValidationError(getLocalizedMessage('registration.password.mismatch', language));
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new ValidationError(passwordValidation.message);
  }

  const existingUser = await User.findOne({ email, IsDeleted: { $ne: true } });
  if (existingUser) {
    if (getAuthProvider(existingUser) !== 'email') {
      throw new AuthenticationError(getLocalizedMessage('auth.sso.provider.account.exists', language));
    }
    throw new UserExistsError();
  }

  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const settingsData = {
    periodStartReminder: false,
    cycleInsightWeekly: false,
    language: language
  };

  const deletedUser = await User.findOne({ email: email.toLowerCase(), IsDeleted: true });
  if (deletedUser) {
    try {
      const now = new Date();
      const reactivatedUser = await User.findByIdAndUpdate(
        deletedUser._id,
        {
          $set: {
            name,
            password: hashedPassword,
            authProvider: 'email',
            settings: settingsData,
            dob: null,
            createdAt: now,
            updatedAt: now,
            IsDeleted: false,
            DeletedAt: null
          },
          $unset: {
            phone: 1,
            gender: 1,
            profilePicture: 1,
            googleSub: 1,
            appleSub: 1,
            personalization: 1
          }
        },
        { new: true, runValidators: true, select: '-password' }
      );

      const tokenPayload = {
        userId: reactivatedUser._id,
        email: reactivatedUser.email,
        name: reactivatedUser.name
      };
      return buildAuthResponse(reactivatedUser, generateToken(tokenPayload));
    } catch (error) {
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
      }
      throw new DatabaseError(getLocalizedMessage('failed.create.user', language));
    }
  }

  const userObject = {
    name,
    email,
    password: hashedPassword,
    authProvider: 'email',
    settings: settingsData
  };

  try {
    const user = new User(userObject);
    const savedUser = await user.save();

    const tokenPayload = {
      userId: savedUser._id,
      email: savedUser.email,
      name: savedUser.name
    };
    return buildAuthResponse(savedUser, generateToken(tokenPayload));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
    }
    throw new DatabaseError(getLocalizedMessage('failed.create.user', language));
  }
};

/**
 * Get user by ID (password excluded)
 * @param {string} userId - User ID
 * @param {string} language - Language code (en or de)
 * @returns {Object} - User data without password
 */
const getUserById = async (userId, language = 'en') => {
  try {
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    return user;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError(getLocalizedMessage('error.invalid.id.format', language));
    }
    if (error.name === 'ValidationError') {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.user', language));
  }
};

/**
 * Login user with email and password
 * @param {Object} loginData - Login credentials
 * @param {string} language - Language code (en or de)
 * @returns {Object} - User data and JWT token
 */
const loginUser = async (loginData, language = 'en') => {
  const { email, password } = loginData;

  // Validate required fields
  if (!email || !password) {
    throw new ValidationError(getLocalizedMessage('login.email.password.required', language));
  }

  // Email validation
  if (!isValidEmail(email)) {
    throw new ValidationError(getLocalizedMessage('error.email.invalid', language));
  }

  try {
    // Find user by email (include password for comparison, only non-deleted users)
    const user = await User.findOne({ email, IsDeleted: { $ne: true } }).select('+password');
    
    if (!user) {
      throw new AuthenticationError(getLocalizedMessage('login.invalid.credentials', language));
    }

    const authProvider = getAuthProvider(user);
    if (authProvider !== 'email') {
      throw new AuthenticationError(getLocalizedMessage('auth.login.use.sso', language));
    }

    if (!user.password) {
      throw new AuthenticationError(getLocalizedMessage('auth.login.no.password', language));
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AuthenticationError(getLocalizedMessage('login.invalid.credentials', language));
    }

    const tokenPayload = {
      userId: user._id,
      email: user.email,
      name: user.name
    };

    return buildAuthResponse(user, generateToken(tokenPayload));

  } catch (error) {
    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('login.failed', language));
  }
};

/**
 * Update user profile fields (name, phone, gender, dob)
 * @param {string} userId - User ID
 * @param {Object} updateData - Fields to update
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated user data (password excluded)
 */
const updateUser = async (userId, updateData, language = 'en') => {
  // Only allow updating name, phone, gender, dob
  const allowedFields = ['name', 'phone', 'gender', 'dob'];
  const updateFields = {};
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field];
    }
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true, select: '-password' }
    );

    if (!updatedUser) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    return updatedUser;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      throw new ValidationError(getLocalizedMessage('error.validation.error', language), validationErrors);
    }
    throw new DatabaseError(getLocalizedMessage('failed.update.user', language));
  }
};

/**
 * Update user profile fields and profile picture
 * @param {string} userId - User ID
 * @param {Object} updateData - Profile fields to update
 * @param {Buffer} imageBuffer - Image buffer (optional)
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated user data (password excluded)
 */
const updateUserWithProfilePicture = async (userId, updateData, imageBuffer = null, language = 'en') => {
  try {
    // Get current user to check if they exist and get current profile picture
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Prepare update object for profile fields
    const allowedFields = ['name', 'phone', 'gender', 'dob'];
    const updateFields = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    // Handle profile picture upload if provided
    let profilePictureUpdate = {};
    if (imageBuffer) {
      // Upload image to Cloudinary
      const uploadResult = await CloudinaryService.uploadImage(
        imageBuffer,
        'profile-pictures',
        currentUser.profilePicture?.publicId || null
      );

      profilePictureUpdate = {
        'profilePicture.url': uploadResult.url,
        'profilePicture.publicId': uploadResult.publicId
      };
    }

    // Combine all updates
    const allUpdates = { ...updateFields, ...profilePictureUpdate };

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: allUpdates },
      { new: true, runValidators: true, select: '-password' }
    );

    return updatedUser;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.update.profile', language));
  }
};

/**
 * Get user settings
 * @param {string} userId
 * @param {string} language - Language code (en or de)
 * @returns {Object} settings
 */
const getUserSettings = async (userId, language = 'en') => {
  const user = await User.findById(userId).select('settings');
  if (!user) throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
  return user.settings;
};

/**
 * Update user settings
 * @param {string} userId
 * @param {Object} settingsUpdate
 * @param {string} language - Language code (en or de)
 * @returns {Object} updated settings
 */
const updateUserSettings = async (userId, settingsUpdate, language = 'en') => {
  const allowedFields = ['periodStartReminder', 'cycleInsightWeekly', 'language'];
  const update = {};
  for (const field of allowedFields) {
    if (settingsUpdate[field] !== undefined) {
      update[`settings.${field}`] = settingsUpdate[field];
    }
  }
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true, select: 'settings' }
  );
  if (!user) throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
  return user.settings;
};

/**
 * Update user profile picture
 * @param {string} userId - User ID
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated user data with new profile picture
 */
const updateProfilePicture = async (userId, imageBuffer, language = 'en') => {
  try {
    // Get current user to check if they have an existing profile picture
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Upload image to Cloudinary
    const uploadResult = await CloudinaryService.uploadImage(
      imageBuffer,
      'profile-pictures',
      currentUser.profilePicture?.publicId || null
    );

    // Update user with new profile picture
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'profilePicture.url': uploadResult.url,
          'profilePicture.publicId': uploadResult.publicId
        }
      },
      { new: true, runValidators: true, select: '-password' }
    );

    return updatedUser;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.update.picture', language));
  }
};

/**
 * Delete user profile picture
 * @param {string} userId - User ID
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated user data without profile picture
 */
const deleteProfilePicture = async (userId, language = 'en') => {
  try {
    // Get current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Delete from Cloudinary if exists
    if (currentUser.profilePicture?.publicId) {
      await CloudinaryService.deleteImage(currentUser.profilePicture.publicId);
    }

    // Remove profile picture from user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $unset: { profilePicture: 1 }
      },
      { new: true, runValidators: true, select: '-password' }
    );

    return updatedUser;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.delete.picture', language));
  }
};

/**
 * Get all allowed symptoms (static list)
 * @returns {Array} - Array of allowed symptoms
 */
const getAllSymptoms = () => {
  return [
    'Cramps',
    'Headache', 
    'Acne',
    'Bloating',
    'Fatigue',
    'Breast tenderness',
    'Diarrhea or constipation',
    'Mood swings'
  ];
};

/**
 * Submit daily symptoms for a user
 * @param {string} userId - User ID
 * @param {Array} symptoms - Array of symptoms (complete list for the day)
 * @param {string} userTimezone - User's timezone (default: UTC)
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Created or updated daily symptom entry
 */
const submitDailySymptoms = async (userId, symptoms, userTimezone = 'UTC', language = 'en') => {
  try {
    // Validate symptoms
    const allowedSymptoms = getAllSymptoms();
    for (const symptom of symptoms) {
      if (!allowedSymptoms.includes(symptom)) {
        throw new ValidationError(getLocalizedMessage('validation.invalid.symptom', language, { 
          symptom, 
          allowed: allowedSymptoms.join(', ') 
        }));
      }
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Get today's date at midnight in user's timezone
    const todayDate = moment.tz(userTimezone).startOf('day').toDate();

    // Compare dates by day in user's timezone
    const todayDateString = moment(todayDate).tz(userTimezone).format('YYYY-MM-DD');

    // Find all entries for this user
    const entries = await DailySymptom.find({ userId });

    // Check if there's already an entry for today
    let dailyEntry = entries.find(entry => {
      const entryDateString = moment(entry.date).tz(userTimezone).format('YYYY-MM-DD');
      return entryDateString === todayDateString;
    });

    if (dailyEntry) {
      // Update existing entry
      dailyEntry = await DailySymptom.findByIdAndUpdate(
        dailyEntry._id,
        {
          symptoms: symptoms
        },
        { new: true, runValidators: true }
      );
    } else {
      // Create new entry for today
      dailyEntry = new DailySymptom({
        userId,
        date: todayDate,
        symptoms
      });
      await dailyEntry.save();
    }

    return dailyEntry;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error.code === 11000) throw new ValidationError(getLocalizedMessage('validation.symptom.entry.exists', language));
    throw new DatabaseError(getLocalizedMessage('failed.submit.symptoms', language));
  }
};

/**
 * Update today's symptoms for a user
 * @param {string} userId - User ID
 * @param {Array} symptoms - New array of symptoms (replaces existing)
 * @param {string} userTimezone - User's timezone (default: UTC)
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated daily symptom entry
 */
const updateDailySymptoms = async (userId, symptoms, userTimezone = 'UTC', language = 'en') => {
  try {
    // Validate symptoms
    const allowedSymptoms = getAllSymptoms();
    for (const symptom of symptoms) {
      if (!allowedSymptoms.includes(symptom)) {
        throw new ValidationError(getLocalizedMessage('validation.invalid.symptom', language, { 
          symptom, 
          allowed: allowedSymptoms.join(', ') 
        }));
      }
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Get today's date in user's timezone
    const todayDate = DailySymptom.getTodayDate(userTimezone);
    
    // Find entry for today using a simpler approach
    const todayDateString = todayDate.toISOString().split('T')[0];
    
    // Find all entries for this user
    const entries = await DailySymptom.find({ userId });
    
    // Check if there's already an entry for today
    let dailyEntry = entries.find(entry => {
      const entryDateString = entry.date.toISOString().split('T')[0];
      return entryDateString === todayDateString;
    });

    if (!dailyEntry) {
      throw new ValidationError(getLocalizedMessage('validation.no.symptom.entry', language));
    }

    // Check if entry can be modified (same day)
    if (!dailyEntry.canBeModified(userTimezone)) {
      throw new ValidationError(getLocalizedMessage('validation.cannot.modify.past', language));
    }

    // Update the entry - REPLACE all symptoms with the new ones
    dailyEntry = await DailySymptom.findByIdAndUpdate(
      dailyEntry._id,
      { symptoms }, // Replace with new symptoms array
      { new: true, runValidators: true }
    );

    return dailyEntry;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.update.symptoms', language));
  }
};

/**
 * Get today's symptoms for a user
 * @param {string} userId - User ID
 * @param {string} userTimezone - User's timezone (default: UTC)
 * @param {string} language - Language code (en or de)
 * @returns {Object|null} - Today's symptom entry or null if none exists
 */
const getDailySymptoms = async (userId, userTimezone = 'UTC', language = 'en') => {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Get today's date in user's timezone
    const todayDate = moment().tz(userTimezone).startOf('day').toDate();
    const todayDateString = todayDate.toISOString().split('T')[0];

    // Find all entries for this user
    const entries = await DailySymptom.find({ userId });

    // Find the entry for today
    const dailyEntry = entries.find(entry => {
      // Convert entry.date to user's timezone
      const entryDateString = moment(entry.date).tz(userTimezone).format('YYYY-MM-DD');
      return entryDateString === todayDateString;
    });

    return dailyEntry;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptoms', language));
  }
};

/**
 * Get symptoms for a specific date
 * @param {string} userId - User ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} userTimezone - User's timezone (default: UTC)
 * @param {string} language - Language code (en or de)
 * @returns {Object|null} - Symptom entry for the specified date or null if none exists
 */
const getDailySymptomsByDate = async (userId, date, userTimezone = 'UTC', language = 'en') => {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Parse the date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new ValidationError(getLocalizedMessage('validation.invalid.date.format', language));
    }

    // Get the date string in YYYY-MM-DD format for comparison
    const targetDateString = targetDate.toISOString().split('T')[0];
    
    // Find all entries for this user
    const entries = await DailySymptom.find({ userId });
    
    // Find the entry that matches the target date
    const dailyEntry = entries.find(entry => {
      const entryDateString = entry.date.toISOString().split('T')[0];
      return entryDateString === targetDateString;
    });

    return dailyEntry || null;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptom.date', language));
  }
};

/**
 * Get symptom history for a user (last 30 days)
 * @param {string} userId - User ID
 * @param {string} userTimezone - User's timezone (default: UTC)
 * @param {string} language - Language code (en or de)
 * @returns {Array} - Array of daily symptom entries
 */
const getSymptomHistory = async (userId, userTimezone = 'UTC', language = 'en') => {
  try {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Get date 30 days ago in user's timezone
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = DailySymptom.getTodayDate(userTimezone);
    startDate.setDate(startDate.getDate() - 30);

    // Find entries from the last 30 days
    const history = await DailySymptom.find({
      userId,
      date: { $gte: startDate }
    }).sort({ date: -1 });

    return history;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptom.history', language));
  }
};

/**
 * Delete a daily symptom entry by ID
 * @param {string} entryId - Daily symptom entry ID
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Result of deletion
 */
const deleteDailySymptom = async (entryId, language = 'en') => {
  try {
    const deletedEntry = await DailySymptom.findByIdAndDelete(entryId);
    if (!deletedEntry) {
      throw new ValidationError(getLocalizedMessage('validation.symptom.entry.not.found', language));
    }
    return deletedEntry;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.delete.symptom', language));
  }
};

/**
 * Delete user account (soft delete)
 * @param {string} userId - User ID
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Updated user data
 */
const deleteAccount = async (userId, language = 'en') => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    if (user.IsDeleted) {
      throw new ValidationError(getLocalizedMessage('error.account.already.deleted', language));
    }

    // Soft delete: set IsDeleted, DeletedAt, and remove password
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          IsDeleted: true,
          DeletedAt: new Date()
        },
        $unset: {
          password: 1
        }
      },
      { new: true, runValidators: true, select: '-password' }
    );

    // Delete all menstrual cycle data for this user
    await MenstrualCycle.deleteMany({ userId });

    return updatedUser;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.delete.account', language));
  }
};

/**
 * Reset user password using temporary token
 * @param {string} email - User's email address
 * @param {string} newPassword - New password to set
 * @param {string} tempToken - Temporary token from OTP verification
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Success message
 */
const resetPassword = async (email, newPassword, tempToken, language = 'en') => {
  try {
    // Validate required fields
    if (!email || !newPassword || !tempToken) {
      throw new ValidationError(getLocalizedMessage('error.email.password.token.required', language));
    }

    // Validate tempToken
    let decoded;
    try {
      decoded = validateTempToken(tempToken, TempTokenType.RESET_PASSWORD);
    } catch (err) {
      throw new AuthenticationError(getLocalizedMessage('error.invalid.or.expired.token', language));
    }

    // Verify email in token matches provided email
    if (decoded.email !== email) {
      throw new AuthenticationError(getLocalizedMessage('error.invalid.or.expired.token', language));
    }

    // Check if user exists and is NOT deleted
    const user = await User.findOne({ email, IsDeleted: { $ne: true } });
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    if (getAuthProvider(user) !== 'email') {
      throw new AuthenticationError(getLocalizedMessage('auth.reset.password.sso.only', language));
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    return {
      message: getLocalizedMessage('user.password.reset', language)
    };

  } catch (error) {
    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.reset.password', language));
  }
};

/**
 * Validate password against regex rules (length, letter, number, allowed chars).
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, message: string|null }
 */
const validatePasswordStrength = (password) => {
  const result = validatePassword(password || '');
  return {
    valid: result.isValid,
    message: result.message || null
  };
};

/**
 * Get whether the user's onboarding personalization profile is complete
 * @param {string} userId - User ID
 * @param {string} language - Language code (en or de)
 * @returns {Object} - Profile completion status
 */
const getProfileStatus = async (userId, language = 'en') => {
  const user = await getUserById(userId, language);
  const isProfileComplete = deriveIsProfileComplete(user);
  const missingFields = isProfileComplete
    ? []
    : REQUIRED_PERSONALIZATION_FIELDS.filter(
        (field) => !isPersonalizationFieldPresent(user.personalization?.[field], field)
      );

  return {
    isProfileComplete,
    authProvider: getAuthProvider(user),
    missingFields
  };
};

/**
 * Complete personalization profile (SSO users or incomplete profiles)
 */
const completePersonalization = async (userId, personalization, language = 'en') => {
  const user = await User.findById(userId).select('-password');
  if (!user || user.IsDeleted) {
    throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
  }

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

  const personalizationData = buildPersonalizationData(personalization);
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: { personalization: personalizationData } },
    { new: true, runValidators: true, select: '-password' }
  );

  return {
    user: buildAuthResponse(updatedUser, null).user,
    authProvider: getAuthProvider(updatedUser),
    isProfileComplete: true
  };
};

module.exports = {
  registerUser,
  registerUserV1,
  getUserById,
  loginUser,
  updateUser,
  updateUserWithProfilePicture,
  getUserSettings,
  updateUserSettings,
  updateProfilePicture,
  deleteProfilePicture,
  getAllSymptoms,
  submitDailySymptoms,
  updateDailySymptoms,
  getDailySymptoms,
  getDailySymptomsByDate,
  getSymptomHistory,
  deleteDailySymptom,
  deleteAccount,
  resetPassword,
  validatePasswordStrength,
  completePersonalization,
  getProfileStatus
}; 