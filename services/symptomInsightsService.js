const moment = require('moment-timezone');
const DailySymptom = require('../models/DailySymptom');
const Symptom = require('../models/Symptom');
const User = require('../models/User');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');

const VALID_FILTERS = ['today', '7d', '30d', 'custom'];

const formatDateKey = (date) => moment.utc(date).format('YYYY-MM-DD');

const parseDateStringToStorageDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const resolveDateRange = (filter, timezone, startDateParam, endDateParam, language) => {
  if (!VALID_FILTERS.includes(filter)) {
    throw new ValidationError(getLocalizedMessage('validation.insights.invalid.filter', language));
  }

  const todayDate = DailySymptom.getTodayDate(timezone);

  if (filter === 'custom') {
    if (!startDateParam || !endDateParam) {
      throw new ValidationError(getLocalizedMessage('validation.insights.dates.required', language));
    }

    const startMoment = moment(startDateParam, 'YYYY-MM-DD', true);
    const endMoment = moment(endDateParam, 'YYYY-MM-DD', true);

    if (!startMoment.isValid() || !endMoment.isValid()) {
      throw new ValidationError(getLocalizedMessage('validation.invalid.date.format', language));
    }

    const startDate = parseDateStringToStorageDate(startDateParam);
    const endDate = parseDateStringToStorageDate(endDateParam);

    if (endDate < startDate) {
      throw new ValidationError(getLocalizedMessage('validation.insights.end.before.start', language));
    }

    const totalDaysInRange = endMoment.diff(startMoment, 'days') + 1;

    return {
      startDate,
      endDate,
      startDateString: startDateParam,
      endDateString: endDateParam,
      totalDaysInRange
    };
  }

  const endDate = todayDate;
  let startDate = new Date(todayDate);

  if (filter === '7d') {
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  } else if (filter === '30d') {
    startDate.setUTCDate(startDate.getUTCDate() - 29);
  }

  const startDateString = formatDateKey(startDate);
  const endDateString = formatDateKey(endDate);
  const totalDaysInRange = moment(endDateString).diff(moment(startDateString), 'days') + 1;

  return {
    startDate,
    endDate,
    startDateString,
    endDateString,
    totalDaysInRange
  };
};

const mapSymptomDoc = (symptom, selectedLanguage) => ({
  id: symptom._id.toString(),
  name: symptom.translations?.[selectedLanguage] || symptom.translations?.en || '',
  image: symptom.image || '',
  category: symptom.category?.[selectedLanguage] || symptom.category?.en || ''
});

/**
 * Filtered symptoms with the dates each was logged.
 * Query: filter + timezone (+ startDate/endDate when custom).
 */
const getSymptomsWithLoggedDates = async (userId, options, language = 'en') => {
  const {
    filter,
    timezone = 'UTC',
    startDate: startDateParam,
    endDate: endDateParam
  } = options;

  try {
    if (!filter) {
      throw new ValidationError(getLocalizedMessage('validation.insights.invalid.filter', language));
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    const selectedLanguage = language === 'de' ? 'de' : 'en';
    const dateRange = resolveDateRange(filter, timezone, startDateParam, endDateParam, language);

    const dailyEntries = await DailySymptom.find({
      userId,
      date: { $gte: dateRange.startDate, $lte: dateRange.endDate }
    })
      .sort({ date: -1 })
      .lean();

    const allSymptomIds = [
      ...new Set(
        dailyEntries.flatMap((entry) =>
          (entry.symptoms || []).map((symptomId) => symptomId.toString())
        )
      )
    ];

    const symptomDocs = await Symptom.find({ _id: { $in: allSymptomIds } }).lean();
    const symptomMap = new Map(
      symptomDocs.map((symptom) => [symptom._id.toString(), mapSymptomDoc(symptom, selectedLanguage)])
    );

    const datesBySymptom = new Map();

    dailyEntries.forEach((entry) => {
      const dateKey = formatDateKey(entry.date);
      (entry.symptoms || []).forEach((symptomId) => {
        const key = symptomId.toString();
        if (!symptomMap.has(key)) {
          return;
        }
        if (!datesBySymptom.has(key)) {
          datesBySymptom.set(key, new Set());
        }
        datesBySymptom.get(key).add(dateKey);
      });
    });

    const symptoms = [];
    datesBySymptom.forEach((dateSet, symptomId) => {
      const mapped = symptomMap.get(symptomId);
      if (!mapped) {
        return;
      }

      const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
      symptoms.push({
        ...mapped,
        frequency: dates.length,
        dates
      });
    });

    symptoms.sort((a, b) => {
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return a.name.localeCompare(b.name);
    });

    const daysWithSymptoms = dailyEntries.filter((entry) => (entry.symptoms || []).length > 0).length;

    return {
      filter,
      timezone,
      dateRange: {
        startDate: dateRange.startDateString,
        endDate: dateRange.endDateString
      },
      symptoms,
      meta: {
        totalDistinctSymptoms: symptoms.length,
        daysWithSymptoms,
        totalDaysInRange: dateRange.totalDaysInRange
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptom.insights', language));
  }
};

module.exports = {
  getSymptomsWithLoggedDates
};
