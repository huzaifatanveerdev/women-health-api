const Symptom = require('../models/Symptom');
const symptomsConfig = require('../config/symptoms');
const DailySymptom = require('../models/DailySymptom');
const User = require('../models/User');
const moment = require('moment-timezone');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');

const toSlugKey = (value) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const seedSymptoms = async () => {
  const slugOccurrences = new Map();

  symptomsConfig.forEach((group) => {
    (group.items || []).forEach((item) => {
      const baseSlug = toSlugKey(item.en);
      slugOccurrences.set(baseSlug, (slugOccurrences.get(baseSlug) || 0) + 1);
    });
  });

  const flattened = symptomsConfig.flatMap((group) =>
    (group.items || []).map((item) => {
      const baseSlug = toSlugKey(item.en);
      const categorySlug = toSlugKey(group.category?.en || '');
      const slugKey = slugOccurrences.get(baseSlug) > 1
        ? `${baseSlug}-${categorySlug}`
        : baseSlug;

      return {
        slugKey,
        translations: {
          en: item.en,
          de: item.de
        },
        category: {
          en: group.category?.en || '',
          de: group.category?.de || ''
        },
        image: item.image || ''
      };
    })
  );

  const uniqueSymptomsBySlug = new Map();
  flattened.forEach((symptom) => {
    uniqueSymptomsBySlug.set(symptom.slugKey, symptom);
  });

  const symptoms = Array.from(uniqueSymptomsBySlug.values());

  await Promise.all(
    symptoms.map((symptom) =>
      Symptom.updateOne(
        { slugKey: symptom.slugKey },
        {
          $set: {
            translations: symptom.translations,
            category: symptom.category,
            image: symptom.image
          }
        },
        { upsert: true }
      )
    )
  );

  await Symptom.deleteMany({
    slugKey: {
      $nin: symptoms.map((symptom) => symptom.slugKey)
    }
  });

  return symptoms.length;
};

const getSymptoms = async (language = 'en') => {
  const selectedLanguage = language === 'de' ? 'de' : 'en';
  const symptoms = await Symptom.find({})
    .sort({ [`category.${selectedLanguage}`]: 1, [`translations.${selectedLanguage}`]: 1 })
    .lean();

  const groupedByCategory = new Map();

  symptoms.forEach((symptom) => {
    const categoryName = symptom.category?.[selectedLanguage] || symptom.category?.en || '';
    const symptomName = symptom.translations?.[selectedLanguage] || symptom.translations?.en || '';
    const symptomImage = symptom.image || '';

    if (!groupedByCategory.has(categoryName)) {
      groupedByCategory.set(categoryName, {
        category: categoryName,
        items: []
      });
    }

    groupedByCategory.get(categoryName).items.push({
      id: symptom._id,
      name: symptomName,
      image: symptomImage
    });
  });

  return Array.from(groupedByCategory.values());
};

const getDailySymptoms = async (userId, userTimezone = 'UTC', language = 'en') => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    const todayDate = DailySymptom.getTodayDate(userTimezone);
    console.log('todayDate:', todayDate);
    const { startOfDay, endOfDay } = DailySymptom.getDayBoundaries(todayDate, userTimezone);

    const dailyEntry = await DailySymptom.findOne({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    return dailyEntry;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptoms', language));
  }
};

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

const submitDailySymptoms = async (userId, symptomIds, userTimezone = 'UTC', language = 'en') => {
  try {
    console.log('userTimezone:', userTimezone);
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    // Validate that all provided IDs exist in the Symptom collection
    const validSymptoms = await Symptom.find({ _id: { $in: symptomIds } });
    if (validSymptoms.length !== symptomIds.length) {
      throw new ValidationError(getLocalizedMessage('error.symptoms.invalid', language));
    }

    const todayDate = DailySymptom.getTodayDate(userTimezone);
console.log('todayDate:', todayDate);
    const dailyEntry = await DailySymptom.findOneAndUpdate(
      { userId, date: todayDate },
      { userId, date: todayDate, symptoms: symptomIds },
      { upsert: true, new: true }
    );

    return dailyEntry;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.submit.symptoms', language));
  }
};

const getTodayDailySymptoms = async (userId, userTimezone = 'UTC', language = 'en') => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    const selectedLanguage = language === 'de' ? 'de' : 'en';
    const todayDate = DailySymptom.getTodayDate(userTimezone);
    const { startOfDay, endOfDay } = DailySymptom.getDayBoundaries(todayDate, 'UTC');

    const dailyEntry = await DailySymptom.findOne({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const date = moment.utc(todayDate).format('YYYY-MM-DD');

    if (!dailyEntry) {
      return {
        date,
        symptoms: []
      };
    }

    const symptomIds = (dailyEntry.symptoms || []).map((symptomId) => symptomId.toString());
    const symptomDocs = await Symptom.find({ _id: { $in: symptomIds } }).lean();
    const symptomMap = new Map(symptomDocs.map((symptom) => [symptom._id.toString(), symptom]));

    const symptoms = symptomIds
      .map((symptomId) => {
        const symptom = symptomMap.get(symptomId);
        if (!symptom) {
          return null;
        }
        return {
          id: symptom._id.toString(),
          name: symptom.translations?.[selectedLanguage] || symptom.translations?.en || '',
          image: symptom.image || ''
        };
      })
      .filter(Boolean);

    return {
      date,
      symptoms
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptoms', language));
  }
};

const getDailySymptomsByDate = async (userId, date, userTimezone = 'UTC', language = 'en') => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    const targetDate = moment(date, 'YYYY-MM-DD', true);
    if (!targetDate.isValid()) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
    }

    const selectedLanguage = language === 'de' ? 'de' : 'en';
    const dayDate = moment.utc(date, 'YYYY-MM-DD').startOf('day').toDate();
    const { startOfDay, endOfDay } = DailySymptom.getDayBoundaries(dayDate, 'UTC');

    const dailyEntry = await DailySymptom.findOne({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const formattedDate = moment.utc(dayDate).format('YYYY-MM-DD');

    if (!dailyEntry) {
      return {
        date: formattedDate,
        symptoms: []
      };
    }

    const symptomIds = (dailyEntry.symptoms || []).map((symptomId) => symptomId.toString());
    const symptomDocs = await Symptom.find({ _id: { $in: symptomIds } }).lean();
    const symptomMap = new Map(symptomDocs.map((symptom) => [symptom._id.toString(), symptom]));

    const symptoms = symptomIds
      .map((symptomId) => {
        const symptom = symptomMap.get(symptomId);
        if (!symptom) {
          return null;
        }
        return {
          id: symptom._id.toString(),
          name: symptom.translations?.[selectedLanguage] || symptom.translations?.en || '',
          image: symptom.image || ''
        };
      })
      .filter(Boolean);

    return {
      date: formattedDate,
      symptoms
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptoms', language));
  }
};

module.exports = {
  seedSymptoms,
  getSymptoms,
  getDailySymptoms,
  deleteDailySymptom,
  submitDailySymptoms,
  getTodayDailySymptoms,
  getDailySymptomsByDate
};
