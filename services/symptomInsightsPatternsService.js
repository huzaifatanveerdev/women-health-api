const moment = require('moment-timezone');
const DailySymptom = require('../models/DailySymptom');
const Symptom = require('../models/Symptom');
const User = require('../models/User');
const MenstrualCycle = require('../models/MenstrualCycle');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');

const PHASE_KEYS = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

const formatDateKey = (date) => moment.utc(date).format('YYYY-MM-DD');

const normalizeDate = (date) => {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

const determinePhaseKey = (entryDate, cycle) => {
  const day = normalizeDate(entryDate);
  const menstrualStart = normalizeDate(cycle.menstrualPhaseStartDate);
  const menstrualEnd = normalizeDate(cycle.menstrualPhaseEndDate);
  const ovulationDate = normalizeDate(cycle.ovulationDate);
  const fertileStart = normalizeDate(cycle.fertileWindowStartDate);
  const fertileEnd = normalizeDate(cycle.fertileWindowEndDate);
  const follicularStart = normalizeDate(cycle.follicularPhaseStartDate);
  const follicularEnd = normalizeDate(cycle.follicularPhaseEndDate);
  const lutealStart = normalizeDate(cycle.lutealPhaseStartDate);
  const lutealEnd = normalizeDate(cycle.lutealPhaseEndDate);

  if (day >= menstrualStart && day <= menstrualEnd) {
    return 'menstrual';
  }
  if (day.getTime() === ovulationDate.getTime()) {
    return 'ovulatory';
  }
  if (day >= fertileStart && day <= fertileEnd) {
    return 'ovulatory';
  }
  if (day >= follicularStart && day <= follicularEnd) {
    return 'follicular';
  }
  if (day >= lutealStart && day <= lutealEnd) {
    return 'luteal';
  }

  return null;
};

const findCycleForDate = (cycles, entryDate) => {
  const day = normalizeDate(entryDate);

  return cycles.find((cycle) => {
    const cycleStart = normalizeDate(cycle.lastPeriodStartDate);
    const cycleEnd = normalizeDate(cycle.cycleEndDate);
    return day >= cycleStart && day <= cycleEnd;
  });
};

const mapSymptomDoc = (symptom, selectedLanguage) => ({
  id: symptom._id.toString(),
  name: symptom.translations?.[selectedLanguage] || symptom.translations?.en || '',
  image: symptom.image || '',
  category: symptom.category?.[selectedLanguage] || symptom.category?.en || ''
});

const createEmptyPhaseDaySets = () => {
  const phases = new Map();
  PHASE_KEYS.forEach((phaseKey) => phases.set(phaseKey, new Set()));
  return phases;
};

const buildPhaseSummary = (phaseKey, dayCount, language) => {
  const phaseName = getLocalizedMessage(`symptomInsights.patterns.phaseName.${phaseKey}`, language);
  const messageKey =
    dayCount === 1
      ? 'symptomInsights.patterns.phaseCountSingular'
      : 'symptomInsights.patterns.phaseCount';

  return getLocalizedMessage(messageKey, language, {
    count: dayCount,
    phase: phaseName
  });
};

const buildSymptomPatterns = (dailyEntries, cycles, symptomMap, trackedCyclesCount, language) => {
  const symptomStats = new Map();

  dailyEntries.forEach((entry) => {
    const cycle = findCycleForDate(cycles, entry.date);
    if (!cycle) {
      return;
    }

    const phaseKey = determinePhaseKey(entry.date, cycle);
    const dateKey = formatDateKey(entry.date);
    const cycleId = cycle._id.toString();

    (entry.symptoms || []).forEach((symptomId) => {
      const symptomKey = symptomId.toString();
      if (!symptomMap.has(symptomKey)) {
        return;
      }

      if (!symptomStats.has(symptomKey)) {
        symptomStats.set(symptomKey, {
          cycleIds: new Set(),
          phases: createEmptyPhaseDaySets()
        });
      }

      const stats = symptomStats.get(symptomKey);
      stats.cycleIds.add(cycleId);

      if (phaseKey) {
        stats.phases.get(phaseKey).add(dateKey);
      }
    });
  });

  const symptoms = [];

  symptomStats.forEach((stats, symptomId) => {
    const mapped = symptomMap.get(symptomId);
    if (!mapped) {
      return;
    }

    const cyclesWithSymptom = stats.cycleIds.size;
    const byPhase = {};

    PHASE_KEYS.forEach((phaseKey) => {
      const dayCount = stats.phases.get(phaseKey).size;
      if (dayCount > 0) {
        byPhase[phaseKey] = buildPhaseSummary(phaseKey, dayCount, language);
      }
    });

    symptoms.push({
      ...mapped,
      cyclesWithSymptom,
      cyclesSummary: getLocalizedMessage('symptomInsights.patterns.cyclesSummary', language, {
        x: cyclesWithSymptom,
        n: trackedCyclesCount
      }),
      byPhase
    });
  });

  return symptoms
    .filter((symptom) => symptom.cyclesWithSymptom > 1)
    .sort((a, b) => {
      if (b.cyclesWithSymptom !== a.cyclesWithSymptom) {
        return b.cyclesWithSymptom - a.cyclesWithSymptom;
      }
      return a.name.localeCompare(b.name);
    });
};

const getSymptomInsightsPatterns = async (userId, options = {}, language = 'en') => {
  const { timezone = 'UTC' } = options;

  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
    }

    const selectedLanguage = language === 'de' ? 'de' : 'en';

    const cycles = await MenstrualCycle.find({
      userId,
      status: { $in: ['OnGoing', 'Completed'] }
    })
      .sort({ lastPeriodStartDate: -1 })
      .lean();

    const trackedCyclesCount = cycles.length;

    const dailyEntries = await DailySymptom.find({ userId })
      .sort({ date: -1 })
      .lean();

    const hasLoggedSymptoms = dailyEntries.some((entry) => (entry.symptoms || []).length > 0);

    if (!hasLoggedSymptoms) {
      return {
        trackedCyclesCount,
        summary: getLocalizedMessage('symptomInsights.patterns.emptySummary', language),
        symptoms: []
      };
    }

    const symptomIds = [
      ...new Set(
        dailyEntries.flatMap((entry) =>
          (entry.symptoms || []).map((symptomId) => symptomId.toString())
        )
      )
    ];

    const symptomDocs = await Symptom.find({ _id: { $in: symptomIds } }).lean();
    const symptomMap = new Map(
      symptomDocs.map((symptom) => [symptom._id.toString(), mapSymptomDoc(symptom, selectedLanguage)])
    );

    const symptoms = buildSymptomPatterns(
      dailyEntries,
      cycles,
      symptomMap,
      trackedCyclesCount,
      language
    );

    return {
      trackedCyclesCount,
      summary: null,
      symptoms
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptom.insights.patterns', language));
  }
};

module.exports = {
  getSymptomInsightsPatterns
};
