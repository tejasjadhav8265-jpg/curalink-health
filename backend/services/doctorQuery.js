// Turns the search-page URL parameters into a safe MongoDB filter. No database access here (pure functions).
const { escapeRegex } = require('../utils/text');
const { todayIST, addDays, isValidDateString } = require('../utils/dates');

const STOP_WORDS = new Set(['doctor', 'doctors', 'dr', 'specialist', 'for', 'a', 'an', 'the', 'in', 'near', 'me', 'and', 'of']);
const SORTS = ['rating', 'experience', 'fee_asc', 'fee_desc', 'name'];

// Only plain strings are accepted (blocks arrays/objects sneaked in through the URL).
const str = (v) => (typeof v === 'string' ? v.trim().slice(0, 100) : '');
const num = (v, min, max) => {
  if ((typeof v !== 'string' && typeof v !== 'number') || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : undefined;
};

function parseDoctorQuery(query = {}) {
  return {
    q: str(query.q),
    specialization: str(query.specialization),
    department: str(query.department),
    location: str(query.location),
    branch: str(query.branch),
    language: str(query.language),
    gender: ['male', 'female', 'other'].includes(query.gender) ? query.gender : '',
    consultationType: ['in-person', 'video'].includes(query.consultationType) ? query.consultationType : '',
    minExperience: num(query.minExperience, 0, 70),
    minFee: num(query.minFee, 0, 100000),
    maxFee: num(query.maxFee, 0, 100000),
    minRating: num(query.minRating, 0, 5),
    availableOn: str(query.availableOn), // 'today' | 'tomorrow' | 'YYYY-MM-DD'
    sort: SORTS.includes(query.sort) ? query.sort : 'rating',
    page: Math.floor(num(query.page, 1, 10000) ?? 1),
    limit: Math.floor(num(query.limit, 1, 24) ?? 8),
  };
}

// "heart specialist in nashik" -> ['heart', 'nashik']
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t && !STOP_WORDS.has(t));
}

// Which date does the availability filter mean? null = no filter.
function resolveAvailability(value, today = todayIST()) {
  if (!value) return null;
  if (value === 'today') return { date: today, checkTime: true };
  if (value === 'tomorrow') return { date: addDays(today, 1), checkTime: false };
  if (isValidDateString(value)) {
    if (value < today) return { none: true }; // a date in the past can't be booked
    return { date: value, checkTime: value === today };
  }
  return null;
}

const SORT_MAP = {
  rating: { ratingAvg: -1, ratingCount: -1, experience: -1, _id: 1 },
  experience: { experience: -1, ratingAvg: -1, _id: 1 },
  fee_asc: { consultationFee: 1, ratingAvg: -1, _id: 1 },
  fee_desc: { consultationFee: -1, ratingAvg: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

/*
 * ctx comes from the database step:
 *   deptIdsByToken: for each search word, the ids of departments whose name contains it
 *   departmentId:   resolved id of the department filter (null if the name was not found, undefined if unused)
 *   availableIds:   doctor ids working on the chosen date (undefined if the filter is unused)
 * Every search word must match somewhere (name, specialty, condition, procedure or department).
 */
function buildFilter(params, ctx = {}) {
  const and = [{ status: 'active' }];

  tokenize(params.q).forEach((token, i) => {
    const re = new RegExp(escapeRegex(token), 'i');
    const or = [{ name: re }, { specialization: re }, { conditionsTreated: re }, { procedures: re }];
    const deptIds = (ctx.deptIdsByToken && ctx.deptIdsByToken[i]) || [];
    if (deptIds.length) or.push({ department: { $in: deptIds } });
    and.push({ $or: or });
  });

  if (params.specialization) and.push({ specialization: new RegExp(escapeRegex(params.specialization), 'i') });
  if (params.location) and.push({ location: new RegExp(escapeRegex(params.location), 'i') });
  if (params.branch) and.push({ branch: new RegExp(escapeRegex(params.branch), 'i') });
  if (params.language) and.push({ languages: new RegExp(`^${escapeRegex(params.language)}$`, 'i') });
  if (params.gender) and.push({ gender: params.gender });
  if (params.consultationType) and.push({ consultationTypes: params.consultationType });
  if (params.minExperience !== undefined) and.push({ experience: { $gte: params.minExperience } });
  if (params.minRating !== undefined) and.push({ ratingAvg: { $gte: params.minRating } });
  if (params.minFee !== undefined) and.push({ consultationFee: { $gte: params.minFee } });
  if (params.maxFee !== undefined) and.push({ consultationFee: { $lte: params.maxFee } });

  if (params.department) {
    // An unknown department matches nothing (instead of silently showing everyone).
    and.push(ctx.departmentId ? { department: ctx.departmentId } : { _id: { $in: [] } });
  }
  if (ctx.availableIds !== undefined) and.push({ _id: { $in: ctx.availableIds } });

  return { filter: and.length === 1 ? and[0] : { $and: and }, sort: SORT_MAP[params.sort] };
}

module.exports = { parseDoctorQuery, tokenize, resolveAvailability, buildFilter };
