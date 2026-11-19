import { Token } from '../models/Token.js';

const WINDOW = 10; // look at the last N completed consultations
const MIN_SAMPLES = 3; // until we have this many, blend in the clinic default
const MIN_REAL_MS = 30 * 1000; // ignore accidental double-clicks ("consultations" under 30s)

/**
 * Average consultation time in minutes, learned from today's completed tokens.
 * Early in the day (few samples) it leans on the clinic's configured default,
 * then gradually trusts real data.
 */
export async function averageServiceMinutes(clinic, dayKey) {
  const recent = await Token.find({
    clinic: clinic._id,
    dayKey,
    status: 'done',
    serviceMs: { $gte: MIN_REAL_MS },
  })
    .sort({ completedAt: -1 })
    .limit(WINDOW)
    .select('serviceMs')
    .lean();

  return blendAverage(
    recent.map((t) => t.serviceMs / 60000),
    clinic.defaultServiceMinutes
  );
}

export function blendAverage(samplesMin, fallbackMin) {
  const n = samplesMin.length;
  const padded = n < MIN_SAMPLES ? MIN_SAMPLES : n;
  const sum = samplesMin.reduce((a, b) => a + b, 0) + fallbackMin * (padded - n);
  return Math.max(1, sum / padded);
}

/**
 * ETA (minutes) for the person at waiting index i (0 = next in line).
 * - Tokens are spread across all counters.
 * - If every counter is busy, the first "round" waits for the oldest
 *   current consultation to finish (avg minus time already spent).
 */
export function etaMinutes(i, { avg, counters, serving, now = Date.now() }) {
  const lanes = Math.max(1, counters);
  const busy = serving.length;
  let firstFree = 0;
  if (busy >= lanes) {
    const elapsed = Math.min(...serving.map((s) => (now - new Date(s.calledAt).getTime()) / 60000));
    firstFree = Math.max(1, avg - elapsed);
  }
  const rounds = Math.floor(i / lanes);
  return Math.round(firstFree + rounds * avg);
}
