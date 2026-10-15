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

const mapSymptomDoc = (symptom, selectedLanguage) => ({
  id: symptom._id.toString(),
  name: symptom.translations?.[selectedLanguage] || symptom.translations?.en || '',
  image: symptom.image || '',
  category: symptom.category?.[selectedLanguage] || symptom.category?.en || ''
});

const sortByFrequencyThenName = (items) =>
  [...items].sort((a, b) => {
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    return a.name.localeCompare(b.name);
  });

const createEmptyPhaseAggregation = () => {
  const aggregation = new Map();
  PHASE_KEYS.forEach((phaseKey) => aggregation.set(phaseKey, new Map()));
  return aggregation;
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

const buildPhaseDateRanges = (cycle) => ({
  menstrual: {
    startDate: formatDateKey(cycle.menstrualPhaseStartDate),
    endDate: formatDateKey(cycle.menstrualPhaseEndDate)
  },
  follicular: {
    startDate: formatDateKey(cycle.follicularPhaseStartDate),
    endDate: formatDateKey(cycle.follicularPhaseEndDate)
  },
  ovulatory: {
    startDate: formatDateKey(cycle.fertileWindowStartDate),
    endDate: formatDateKey(cycle.fertileWindowEndDate)
  },
  luteal: {
    startDate: formatDateKey(cycle.lutealPhaseStartDate),
    endDate: formatDateKey(cycle.lutealPhaseEndDate)
  }
});

const mapCycleSummary = (cycle) => ({
  cycleId: cycle._id.toString(),
  cycleNumber: cycle.cycleNumber,
  status: cycle.status,
  cycleMonth: {
    startDate: formatDateKey(cycle.lastPeriodStartDate),
    endDate: formatDateKey(cycle.cycleEndDate)
  }
});

const loadSymptomMap = async (symptomIds, selectedLanguage) => {
  if (symptomIds.length === 0) {
    return new Map();
  }

  const symptomDocs = await Symptom.find({ _id: { $in: symptomIds } }).lean();
  return new Map(
    symptomDocs.map((symptom) => [symptom._id.toString(), mapSymptomDoc(symptom, selectedLanguage)])
  );
};

const aggregatePhaseSymptoms = (dailyEntries, cycles, symptomMap) => {
  const phaseAggregation = createEmptyPhaseAggregation();

  dailyEntries.forEach((entry) => {
    const cycle = findCycleForDate(cycles, entry.date);
    if (!cycle) {
      return;
    }

    const phaseKey = determinePhaseKey(entry.date, cycle);
    if (!phaseKey) {
      return;
    }

    const dateKey = formatDateKey(entry.date);
    const phaseSymptoms = phaseAggregation.get(phaseKey);

    (entry.symptoms || []).forEach((symptomId) => {
      const symptomKey = symptomId.toString();
      if (!symptomMap.has(symptomKey)) {
        return;
      }

      if (!phaseSymptoms.has(symptomKey)) {
        phaseSymptoms.set(symptomKey, new Set());
      }
      phaseSymptoms.get(symptomKey).add(dateKey);
    });
  });

  const combinedByPhase = {};

  PHASE_KEYS.forEach((phaseKey) => {
    const items = [];
    phaseAggregation.get(phaseKey).forEach((dateSet, symptomId) => {
      const mapped = symptomMap.get(symptomId);
      if (mapped) {
        items.push({ ...mapped, frequency: dateSet.size });
      }
    });
    combinedByPhase[phaseKey] = sortByFrequencyThenName(items);
  });

  return combinedByPhase;
};

const collectSymptomIds = (dailyEntries) => [
  ...new Set(
    dailyEntries.flatMap((entry) =>
      (entry.symptoms || []).map((symptomId) => symptomId.toString())
    )
  )
];

const ensureUserExists = async (userId, language) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
  }
  return user;
};

/**
 * Symptoms by phase for the user's current OnGoing cycle only.
 * No calendar filter. Empty phases if no ongoing cycle.
 */
const getOngoingCycleSymptomPhases = async (userId, options = {}, language = 'en') => {
  const { timezone = 'UTC' } = options;

  try {
    await ensureUserExists(userId, language);

    const selectedLanguage = language === 'de' ? 'de' : 'en';
    const emptyPhases = {
      menstrual: [],
      follicular: [],
      ovulatory: [],
      luteal: []
    };

    const cycle = await MenstrualCycle.findOne({
      userId,
      status: 'OnGoing'
    })
      .sort({ lastPeriodStartDate: -1 })
      .lean();

    if (!cycle) {
      return {
        timezone,
        cycle: null,
        symptomsByPhase: emptyPhases
      };
    }

    const cycleStart = normalizeDate(cycle.lastPeriodStartDate);
    const cycleEnd = normalizeDate(cycle.cycleEndDate);

    const dailyEntries = await DailySymptom.find({
      userId,
      date: { $gte: cycleStart, $lte: cycleEnd }
    })
      .sort({ date: -1 })
      .lean();

    const symptomMap = await loadSymptomMap(collectSymptomIds(dailyEntries), selectedLanguage);
    const symptomsByPhase = aggregatePhaseSymptoms(dailyEntries, [cycle], symptomMap);

    return {
      timezone,
      cycle: {
        ...mapCycleSummary(cycle),
        phaseDateRanges: buildPhaseDateRanges(cycle)
      },
      symptomsByPhase
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptom.insights.byCycle', language));
  }
};

/**
 * Symptoms by phase for a specific cycle (cycleId + timezone).
 * No calendar filter. Accepts OnGoing and Completed cycles only.
 */
const getSymptomPhasesByCycleId = async (userId, options = {}, language = 'en') => {
  const { cycleId, timezone = 'UTC' } = options;

  try {
    await ensureUserExists(userId, language);

    if (!cycleId) {
      throw new ValidationError(getLocalizedMessage('validation.insights.cycle.not.found', language));
    }

    const selectedLanguage = language === 'de' ? 'de' : 'en';

    const cycle = await MenstrualCycle.findOne({
      _id: cycleId,
      userId,
      status: { $in: ['OnGoing', 'Completed'] }
    }).lean();

    if (!cycle) {
      throw new ValidationError(getLocalizedMessage('validation.insights.cycle.not.found', language));
    }

    const cycleStart = normalizeDate(cycle.lastPeriodStartDate);
    const cycleEnd = normalizeDate(cycle.cycleEndDate);

    const dailyEntries = await DailySymptom.find({
      userId,
      date: { $gte: cycleStart, $lte: cycleEnd }
    })
      .sort({ date: -1 })
      .lean();

    const symptomMap = await loadSymptomMap(collectSymptomIds(dailyEntries), selectedLanguage);
    const symptomsByPhase = aggregatePhaseSymptoms(dailyEntries, [cycle], symptomMap);

    return {
      timezone,
      cycle: {
        ...mapCycleSummary(cycle),
        phaseDateRanges: buildPhaseDateRanges(cycle)
      },
      symptomsByPhase
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(getLocalizedMessage('failed.retrieve.symptom.insights.byCycle', language));
  }
};

module.exports = {
  getOngoingCycleSymptomPhases,
  getSymptomPhasesByCycleId
};
