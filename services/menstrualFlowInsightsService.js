const moment = require('moment-timezone');
const DailySymptom = require('../models/DailySymptom');
const MenstrualFlow = require('../models/MenstrualFlow');
const User = require('../models/User');
const MenstrualCycle = require('../models/MenstrualCycle');
const { ValidationError, DatabaseError } = require('../utils/errors');
const { getLocalizedMessage } = require('../utils/localization');

const VALID_FILTERS = ['today', '7d', '30d', 'custom'];
const PHASE_KEYS = ['menstrual', 'follicular', 'ovulatory', 'luteal'];

const FLOW_LEVELS = {
  Light: 1,
  Medium: 2,
  Heavy: 3
};

const formatDateKey = (date) => moment.utc(date).format('YYYY-MM-DD');

const parseDateStringToStorageDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const normalizeDate = (date) => {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

const createEmptyDistribution = () => ({
  Light: 0,
  Medium: 0,
  Heavy: 0
});

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
  const startDate = new Date(todayDate);

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

const ensureUserExists = async (userId, language) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ValidationError(getLocalizedMessage('error.user.not.found', language));
  }
  return user;
};

const loadCyclesForUser = async (userId) =>
  MenstrualCycle.find({
    userId,
    status: { $in: ['OnGoing', 'Completed'] }
  })
    .sort({ lastPeriodStartDate: -1 })
    .lean();

const loadFlowLogsInRange = async (userId, dateRange, timezone) => {
  const rangeStartUtc = moment
    .tz(dateRange.startDateString, 'YYYY-MM-DD', timezone)
    .startOf('day')
    .toDate();
  const rangeEndUtc = moment
    .tz(dateRange.endDateString, 'YYYY-MM-DD', timezone)
    .endOf('day')
    .toDate();

  return MenstrualFlow.find({
    userId,
    recordedAt: { $gte: rangeStartUtc, $lte: rangeEndUtc }
  })
    .sort({ recordedAt: 1 })
    .lean();
};

const mapFlowLog = (log, timezone) => {
  const recordedMoment = moment(log.recordedAt).tz(timezone);

  return {
    flowId: log._id.toString(),
    date: recordedMoment.format('YYYY-MM-DD'),
    time: recordedMoment.format('HH:mm'),
    recordedAt: new Date(log.recordedAt).toISOString(),
    flow: log.flow,
    level: FLOW_LEVELS[log.flow]
  };
};

const enrichFlowLogs = (logs, cycles, timezone) =>
  logs.map((log) => {
    const mapped = mapFlowLog(log, timezone);
    const dateForPhase = parseDateStringToStorageDate(mapped.date);
    const cycle = findCycleForDate(cycles, dateForPhase);
    const phaseKey = cycle ? determinePhaseKey(dateForPhase, cycle) : null;

    return {
      ...mapped,
      cycle,
      phaseKey
    };
  });

const buildDistribution = (logs) => {
  const distribution = createEmptyDistribution();

  logs.forEach((log) => {
    if (distribution[log.flow] !== undefined) {
      distribution[log.flow] += 1;
    }
  });

  return distribution;
};

const buildEntriesByPhaseWithoutLevel = (logs) => {
  const entriesByPhase = {};

  PHASE_KEYS.forEach((phaseKey) => {
    entriesByPhase[phaseKey] = logs
      .filter((log) => log.phaseKey === phaseKey)
      .map(({ flowId, date, time, recordedAt, flow }) => ({
        flowId,
        date,
        time,
        recordedAt,
        flow
      }));
  });

  return entriesByPhase;
};

const getLogsForFullCycle = (enrichedLogs, cycle) => {
  const cycleStart = normalizeDate(cycle.lastPeriodStartDate);
  const cycleEnd = normalizeDate(cycle.cycleEndDate);
  const cycleId = cycle._id.toString();

  return enrichedLogs.filter((log) => {
    const logDate = parseDateStringToStorageDate(log.date);
    if (logDate < cycleStart || logDate > cycleEnd) {
      return false;
    }

    return log.cycle && log.cycle._id.toString() === cycleId;
  });
};

/**
 * Distribution-only flow counts (no intensity, no phases/cycles).
 * Counts every MenstrualFlow log event in the selected calendar range.
 */
const getMenstrualFlowDistribution = async (userId, options, language = 'en') => {
  const { filter, timezone = 'UTC', startDate, endDate } = options;

  try {
    await ensureUserExists(userId, language);

    const dateRange = resolveDateRange(filter, timezone, startDate, endDate, language);
    const logs = await loadFlowLogsInRange(userId, dateRange, timezone);

    return {
      filter,
      timezone,
      dateRange: {
        startDate: dateRange.startDateString,
        endDate: dateRange.endDateString
      },
      distribution: buildDistribution(logs),
      meta: {
        totalLogs: logs.length
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    throw new DatabaseError(
      getLocalizedMessage('failed.retrieve.flow.insights', language)
    );
  }
};

/**
 * Full-cycle flow detail for one cycle (no calendar filter).
 * Query: cycleId (required), timezone (optional, default UTC).
 */
const getMenstrualFlowCycleDetail = async (userId, options, language = 'en') => {
  const { cycleId, timezone = 'UTC' } = options;

  try {
    await ensureUserExists(userId, language);

    if (!cycleId) {
      throw new ValidationError(getLocalizedMessage('validation.insights.cycle.not.found', language));
    }

    const cycle = await MenstrualCycle.findOne({
      _id: cycleId,
      userId,
      status: { $in: ['OnGoing', 'Completed'] }
    }).lean();

    if (!cycle) {
      throw new ValidationError(getLocalizedMessage('validation.insights.cycle.not.found', language));
    }

    const cycleStartString = formatDateKey(cycle.lastPeriodStartDate);
    const cycleEndString = formatDateKey(cycle.cycleEndDate);
    const dateRange = {
      startDate: normalizeDate(cycle.lastPeriodStartDate),
      endDate: normalizeDate(cycle.cycleEndDate),
      startDateString: cycleStartString,
      endDateString: cycleEndString
    };

    const cycles = await loadCyclesForUser(userId);
    const logs = await loadFlowLogsInRange(userId, dateRange, timezone);
    const enrichedLogs = enrichFlowLogs(logs, cycles, timezone);
    const cycleLogs = getLogsForFullCycle(enrichedLogs, cycle);
    const daysWithFlow = new Set(cycleLogs.map((log) => log.date)).size;

    return {
      timezone,
      cycle: {
        ...mapCycleSummary(cycle),
        phaseDateRanges: buildPhaseDateRanges(cycle),
        entriesByPhase: buildEntriesByPhaseWithoutLevel(cycleLogs),
        meta: {
          totalLogs: cycleLogs.length,
          daysWithFlow
        }
      }
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(
      getLocalizedMessage('failed.retrieve.flow.insights', language)
    );
  }
};

module.exports = {
  getMenstrualFlowCycleDetail,
  getMenstrualFlowDistribution
};
