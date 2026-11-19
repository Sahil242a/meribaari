import mongoose from 'mongoose';
import { Clinic } from '../models/Clinic.js';
import { Token } from '../models/Token.js';
import { nextSeq } from '../models/DayCounter.js';
import { config } from '../config.js';
import { HttpError, dayKey, distanceKm, normalizePhone, randomKey } from '../utils/helpers.js';
import { averageServiceMinutes, etaMinutes } from './estimator.js';
import { notifyOnce } from './notifier.js';
import { emitToClinic, emitToStaff } from '../realtime/socket.js';

const today = () => dayKey(config.timezone);
const QUEUE_SORT = { priority: -1, sortAt: 1, _id: 1 };

export async function getClinicBySlug(slug) {
  const clinic = await Clinic.findOne({ slug: String(slug).toLowerCase() });
  if (!clinic) throw new HttpError(404, 'Clinic nahi mila');
  return clinic;
}

export async function getClinicById(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Clinic nahi mila');
  const clinic = await Clinic.findById(id);
  if (!clinic) throw new HttpError(404, 'Clinic nahi mila');
  return clinic;
}

function findCounter(clinic, counterId) {
  const counter = counterId ? clinic.counters.id(counterId) : clinic.counters[0];
  if (!counter) throw new HttpError(400, 'Counter not found');
  return counter;
}

/* ------------------------------------------------------------------ */
/* Issuing tokens                                                      */
/* ------------------------------------------------------------------ */

export async function issueToken(clinic, { name, phone, source = 'online', priority = false, coords }) {
  if (!clinic.isOpen) throw new HttpError(409, 'Clinic abhi band hai. Tokens are closed for today.');

  const dk = today();
  const normalizedPhone = normalizePhone(phone);

  if (source === 'online' && clinic.joinRadiusKm > 0 && clinic.location?.lat != null) {
    if (!coords) throw new HttpError(400, 'Location chahiye: please allow location to join this queue');
    const km = distanceKm(coords, clinic.location);
    if (km > clinic.joinRadiusKm) {
      throw new HttpError(403, `Aap clinic se ${km.toFixed(1)} km door ho. Join within ${clinic.joinRadiusKm} km.`);
    }
  }

  const waiting = await Token.countDocuments({ clinic: clinic._id, dayKey: dk, status: 'waiting' });
  if (waiting >= clinic.maxWaiting) throw new HttpError(409, 'Queue full hai, thodi der baad try karein');

  if (normalizedPhone) {
    const existing = await Token.findOne({
      clinic: clinic._id,
      dayKey: dk,
      phone: normalizedPhone,
      status: { $in: ['waiting', 'serving'] },
    });
    if (existing) {
      throw new HttpError(409, `Is number pe pehle se token ${existing.number} hai`);
    }
  }

  const seq = await nextSeq(clinic._id, dk);
  const accessKey = randomKey();
  const token = await Token.create({
    clinic: clinic._id,
    dayKey: dk,
    seq,
    number: `${clinic.tokenPrefix}-${seq}`,
    name,
    phone: normalizedPhone,
    source,
    priority: Boolean(priority),
    accessKey,
  });

  await notifyOnce('issued', { token, clinic });
  await broadcast(clinic);
  return { token, accessKey };
}

/* ------------------------------------------------------------------ */
/* Counter actions (staff)                                             */
/* ------------------------------------------------------------------ */

async function finishServing(clinic, counter, status) {
  const current = await Token.findOne({
    clinic: clinic._id,
    status: 'serving',
    counter: counter._id,
  });
  if (!current) return null;
  const now = new Date();
  current.status = status;
  current.completedAt = now;
  // only real consultations feed the wait-time estimate
  if (status === 'done') current.serviceMs = now - current.calledAt;
  await current.save();
  return current;
}

export async function callNext(clinic, counterId) {
  if (clinic.paused) throw new HttpError(409, 'Queue paused hai. Resume first.');
  const counter = findCounter(clinic, counterId);
  await finishServing(clinic, counter, 'done');

  // Atomic claim: two receptionists clicking at once never get the same patient.
  const next = await Token.findOneAndUpdate(
    { clinic: clinic._id, dayKey: today(), status: 'waiting' },
    {
      $set: {
        status: 'serving',
        counter: counter._id,
        counterName: counter.name,
        calledAt: new Date(),
      },
    },
    { sort: QUEUE_SORT, returnDocument: 'after' }
  );

  if (next) await notifyOnce('called', { token: next, clinic });
  await broadcast(clinic, next ? { type: 'called', number: next.number, counter: counter.name } : null);
  return next;
}

export async function completeCurrent(clinic, counterId) {
  const counter = findCounter(clinic, counterId);
  const done = await finishServing(clinic, counter, 'done');
  await broadcast(clinic);
  return done;
}

export async function markNoShow(clinic, counterId) {
  const counter = findCounter(clinic, counterId);
  const t = await finishServing(clinic, counter, 'no_show');
  await broadcast(clinic);
  return t;
}

/** Re-call to the stage a patient who missed their turn: they go back in after the next 2 people. */
export async function requeue(clinic, tokenId) {
  const token = await Token.findOne({ _id: tokenId, clinic: clinic._id });
  if (!token) throw new HttpError(404, 'Token not found');
  if (!['no_show', 'cancelled'].includes(token.status)) {
    throw new HttpError(409, 'Only missed or cancelled tokens can be re-queued');
  }
  const ahead = await Token.find({ clinic: clinic._id, dayKey: token.dayKey, status: 'waiting' })
    .sort(QUEUE_SORT)
    .limit(3)
    .select('sortAt')
    .lean();

  let sortAt;
  if (ahead.length < 3) sortAt = new Date();
  else sortAt = new Date((ahead[1].sortAt.getTime() + ahead[2].sortAt.getTime()) / 2);

  token.status = 'waiting';
  token.sortAt = sortAt;
  token.counter = null;
  token.counterName = '';
  token.calledAt = undefined;
  token.completedAt = undefined;
  token.notifications = token.notifications.filter((n) => n.kind === 'issued');
  await token.save();
  await broadcast(clinic);
  return token;
}

export async function cancelByPatient(tokenId, accessKey) {
  if (!mongoose.isValidObjectId(tokenId)) throw new HttpError(404, 'Token not found');
  const token = await Token.findById(tokenId).select('+accessKey');
  if (!token || token.accessKey !== accessKey) throw new HttpError(403, 'Not allowed');
  if (token.status !== 'waiting') throw new HttpError(409, 'Token is not waiting anymore');
  token.status = 'cancelled';
  token.completedAt = new Date();
  await token.save();
  const clinic = await Clinic.findById(token.clinic);
  await broadcast(clinic);
  return token;
}

export async function setPause(clinic, paused, message = '') {
  clinic.paused = paused;
  clinic.pauseMessage = paused ? message || 'Doctor thodi der ke liye break pe hain' : '';
  await clinic.save();
  await broadcast(clinic);
  return clinic;
}

export async function setOpen(clinic, isOpen) {
  clinic.isOpen = isOpen;
  await clinic.save();
  await broadcast(clinic);
  return clinic;
}

/* ------------------------------------------------------------------ */
/* State + broadcasting                                                */
/* ------------------------------------------------------------------ */

export async function computeState(clinic) {
  const dk = today();
  const [waiting, serving, avg] = await Promise.all([
    Token.find({ clinic: clinic._id, dayKey: dk, status: 'waiting' }).sort(QUEUE_SORT).lean(),
    Token.find({ clinic: clinic._id, dayKey: dk, status: 'serving' }).lean(),
    averageServiceMinutes(clinic, dk),
  ]);

  const ctx = { avg, counters: clinic.counters.length, serving };
  const waitingWithEta = waiting.map((t, i) => ({ ...t, position: i + 1, etaMin: etaMinutes(i, ctx) }));

  return { dayKey: dk, avg, waiting: waitingWithEta, serving };
}

export function toPublicState(clinic, state) {
  return {
    clinic: clinic.toPublic(),
    avgServiceMin: Math.round(state.avg * 10) / 10,
    waitingCount: state.waiting.length,
    serving: clinic.counters.map((c) => {
      const t = state.serving.find((s) => String(s.counter) === String(c._id));
      return { counterId: c._id.toString(), counter: c.name, number: t?.number || null };
    }),
    waiting: state.waiting.map((t) => ({
      id: t._id.toString(),
      number: t.number,
      position: t.position,
      etaMin: t.etaMin,
      priority: t.priority,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function toStaffState(clinic, state) {
  const recent = await Token.find({
    clinic: clinic._id,
    dayKey: state.dayKey,
    status: { $in: ['done', 'no_show', 'cancelled'] },
  })
    .sort({ completedAt: -1 })
    .limit(15)
    .lean();

  const pick = (t) => ({
    id: t._id.toString(),
    number: t.number,
    name: t.name,
    phone: t.phone,
    source: t.source,
    priority: t.priority,
    status: t.status,
    position: t.position,
    etaMin: t.etaMin,
    issuedAt: t.issuedAt,
    calledAt: t.calledAt,
    completedAt: t.completedAt,
    counterId: t.counter ? String(t.counter) : null,
    counterName: t.counterName,
  });

  return {
    ...toPublicState(clinic, state),
    servingDetail: state.serving.map(pick),
    waitingDetail: state.waiting.map(pick),
    recent: recent.map(pick),
  };
}

/** Recompute, push to every screen, and fire "you're almost up" alerts. */
export async function broadcast(clinic, event = null) {
  if (!clinic) return;
  const state = await computeState(clinic);
  const publicState = toPublicState(clinic, state);
  emitToClinic(clinic._id.toString(), 'queue:update', { ...publicState, event });
  emitToStaff(clinic._id.toString(), 'staff:update', { event });

  const near = state.waiting.filter((t) => t.position <= clinic.alertWhenAhead);
  await Promise.all(near.map((t) => notifyOnce('near', { token: t, clinic, position: t.position })));
  return publicState;
}

/** Patient-facing view of a single token. */
export async function tokenView(tokenId) {
  if (!mongoose.isValidObjectId(tokenId)) throw new HttpError(404, 'Token not found');
  const token = await Token.findById(tokenId).lean();
  if (!token) throw new HttpError(404, 'Token not found');
  const clinic = await Clinic.findById(token.clinic);
  const state = await computeState(clinic);
  const mine = state.waiting.find((t) => String(t._id) === String(token._id));
  return {
    token: {
      id: token._id.toString(),
      number: token.number,
      // no name/phone here: token links are shareable, so keep them anonymous
      status: token.status,
      counterName: token.counterName,
      issuedAt: token.issuedAt,
      calledAt: token.calledAt,
      position: mine?.position ?? null,
      etaMin: mine?.etaMin ?? null,
      isToday: token.dayKey === state.dayKey,
    },
    queue: toPublicState(clinic, state),
  };
}
