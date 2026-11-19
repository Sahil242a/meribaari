import { Token } from '../models/Token.js';
import { config } from '../config.js';
import { dayKey } from '../utils/helpers.js';

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

/** Today's numbers plus a 7-day trend for the dashboard. */
export async function clinicAnalytics(clinic) {
  const tz = config.timezone;
  const today = dayKey(tz);
  const days = [...Array(7)].map((_, i) => dayKey(tz, new Date(Date.now() - (6 - i) * 864e5)));

  const [todayStats] = await Token.aggregate([
    { $match: { clinic: clinic._id, dayKey: today } },
    {
      $group: {
        _id: null,
        issued: { $sum: 1 },
        served: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        noShows: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        walkIns: { $sum: { $cond: [{ $eq: ['$source', 'walk_in'] }, 1, 0] } },
        avgServiceMs: { $avg: '$serviceMs' },
        avgWaitMs: {
          $avg: {
            $cond: [{ $ifNull: ['$calledAt', false] }, { $subtract: ['$calledAt', '$issuedAt'] }, null],
          },
        },
      },
    },
  ]);

  const byHour = await Token.aggregate([
    { $match: { clinic: clinic._id, dayKey: today } },
    { $group: { _id: { $hour: { date: '$issuedAt', timezone: tz } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const trendRaw = await Token.aggregate([
    { $match: { clinic: clinic._id, dayKey: { $in: days } } },
    {
      $group: {
        _id: '$dayKey',
        issued: { $sum: 1 },
        served: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      },
    },
  ]);

  const s = todayStats || {};
  const issued = s.issued || 0;
  return {
    today: {
      issued,
      served: s.served || 0,
      noShows: s.noShows || 0,
      cancelled: s.cancelled || 0,
      walkIns: s.walkIns || 0,
      noShowRate: issued ? round1(((s.noShows || 0) / issued) * 100) : 0,
      avgServiceMin: round1(s.avgServiceMs / 60000),
      avgWaitMin: round1(s.avgWaitMs / 60000),
    },
    byHour: byHour.map((h) => ({ hour: h._id, count: h.count })),
    last7Days: days.map((d) => {
      const r = trendRaw.find((x) => x._id === d);
      return { day: d, issued: r?.issued || 0, served: r?.served || 0 };
    }),
  };
}
