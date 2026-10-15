const REQUIRED_PERSONALIZATION_FIELDS = [
  'lastPeriodStartDate',
  'averageMenstrualCycleLength',
  'averagePeriodDuration'
];

const getAuthProvider = (user) => user?.authProvider ?? 'email';

const isPersonalizationFieldPresent = (value, fieldName) => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }
  if (fieldName === 'averagePeriodDuration') {
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
  }
  if (fieldName === 'lastPeriodStartDate') {
    const date = value instanceof Date ? value : new Date(value);
    return !Number.isNaN(date.getTime());
  }
  return true;
};

const deriveIsProfileComplete = (user) => {
  const personalization = user?.personalization;
  if (!personalization) {
    return false;
  }
  return REQUIRED_PERSONALIZATION_FIELDS.every((field) =>
    isPersonalizationFieldPresent(personalization[field], field)
  );
};

const validatePersonalizationPayload = (personalization, language, getLocalizedMessage) => {
  const missingFields = [];
  if (!personalization || typeof personalization !== 'object') {
    return {
      valid: false,
      missingFields: REQUIRED_PERSONALIZATION_FIELDS.map((f) => `personalization.${f}`),
      message: getLocalizedMessage('personalization.incomplete', language)
    };
  }
  for (const field of REQUIRED_PERSONALIZATION_FIELDS) {
    if (!isPersonalizationFieldPresent(personalization[field], field)) {
      missingFields.push(`personalization.${field}`);
    }
  }
  if (missingFields.length > 0) {
    return {
      valid: false,
      missingFields,
      message: getLocalizedMessage('personalization.incomplete', language)
    };
  }
  return { valid: true, missingFields: [] };
};

const buildPersonalizationData = (personalization) => ({
  lastPeriodStartDate: personalization.lastPeriodStartDate
    ? new Date(personalization.lastPeriodStartDate)
    : undefined,
  averageMenstrualCycleLength: String(personalization.averageMenstrualCycleLength).trim(),
  averagePeriodDuration: Number(personalization.averagePeriodDuration)
});

const toUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  gender: user.gender,
  dob: user.dob,
  profilePicture: user.profilePicture,
  personalization: user.personalization,
  settings: user.settings,
  authProvider: getAuthProvider(user),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const buildAuthResponse = (user, token) => ({
  user: toUserResponse(user),
  token,
  authProvider: getAuthProvider(user),
  isProfileComplete: deriveIsProfileComplete(user)
});

module.exports = {
  REQUIRED_PERSONALIZATION_FIELDS,
  getAuthProvider,
  isPersonalizationFieldPresent,
  deriveIsProfileComplete,
  validatePersonalizationPayload,
  buildPersonalizationData,
  toUserResponse,
  buildAuthResponse
};
