import { Router } from 'express';
import { Staff } from '../models/Staff.js';
import { Token } from '../models/Token.js';
import { HttpError, asyncHandler } from '../utils/helpers.js';
import { requireRole, requireStaff, validate } from '../middleware/index.js';
import {
  counterActionSchema,
  openSchema,
  pauseSchema,
  settingsSchema,
  staffCreateSchema,
  walkInSchema,
} from './schemas.js';
import * as queue from '../services/queueService.js';
import { clinicAnalytics } from '../services/analytics.js';

const router = Router();
router.use(requireStaff);

// load the staff member's clinic for every request
router.use(
  asyncHandler(async (req, _res, next) => {
    req.clinic = await queue.getClinicById(req.staff.clinic);
    next();
  })
);

const sendState = async (req, res) => {
  const state = await queue.computeState(req.clinic);
  res.json(await queue.toStaffState(req.clinic, state));
};

router.get('/queue', asyncHandler(sendState));

router.post(
  '/queue/next',
  validate(counterActionSchema),
  asyncHandler(async (req, res) => {
    await queue.callNext(req.clinic, req.body.counterId);
    await sendState(req, res);
  })
);

router.post(
  '/queue/complete',
  validate(counterActionSchema),
  asyncHandler(async (req, res) => {
    await queue.completeCurrent(req.clinic, req.body.counterId);
    await sendState(req, res);
  })
);

router.post(
  '/queue/no-show',
  validate(counterActionSchema),
  asyncHandler(async (req, res) => {
    await queue.markNoShow(req.clinic, req.body.counterId);
    await sendState(req, res);
  })
);

router.post(
  '/tokens/:id/requeue',
  asyncHandler(async (req, res) => {
    await queue.requeue(req.clinic, req.params.id);
    await sendState(req, res);
  })
);

router.post(
  '/walk-in',
  validate(walkInSchema),
  asyncHandler(async (req, res) => {
    const { token } = await queue.issueToken(req.clinic, { ...req.body, source: 'walk_in' });
    res.status(201).json({ id: token._id.toString(), number: token.number });
  })
);

router.post(
  '/pause',
  validate(pauseSchema),
  asyncHandler(async (req, res) => {
    await queue.setPause(req.clinic, req.body.paused, req.body.message);
    await sendState(req, res);
  })
);

router.post(
  '/open',
  validate(openSchema),
  asyncHandler(async (req, res) => {
    await queue.setOpen(req.clinic, req.body.isOpen);
    await sendState(req, res);
  })
);

router.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    res.json(await clinicAnalytics(req.clinic));
  })
);

/* ---------- clinic settings (admin) ---------- */

router.get('/clinic', (req, res) => {
  const c = req.clinic;
  res.json({
    ...c.toPublic(),
    tokenPrefix: c.tokenPrefix,
    defaultServiceMinutes: c.defaultServiceMinutes,
    alertWhenAhead: c.alertWhenAhead,
    maxWaiting: c.maxWaiting,
    location: c.location?.lat != null ? c.location : null,
    joinRadiusKm: c.joinRadiusKm,
  });
});

router.patch(
  '/clinic',
  requireRole('admin'),
  validate(settingsSchema),
  asyncHandler(async (req, res) => {
    const c = req.clinic;
    const { counters, location, ...rest } = req.body;
    Object.assign(c, rest);

    if (location !== undefined) c.location = location || { lat: undefined, lng: undefined };

    if (counters) {
      const keptIds = new Set(counters.filter((x) => x.id).map((x) => x.id));
      const removed = c.counters.filter((x) => !keptIds.has(x._id.toString()));
      if (removed.length) {
        const busy = await Token.exists({
          clinic: c._id,
          status: 'serving',
          counter: { $in: removed.map((r) => r._id) },
        });
        if (busy) throw new HttpError(409, 'Pehle us counter ka current patient complete karein');
      }
      c.counters = counters.map((x) => (x.id ? { _id: x.id, name: x.name } : { name: x.name }));
    }

    await c.save();
    await queue.broadcast(c);
    res.json(c.toPublic());
  })
);

/* ---------- team (admin) ---------- */

router.get(
  '/members',
  asyncHandler(async (req, res) => {
    const members = await Staff.find({ clinic: req.clinic._id }).sort({ createdAt: 1 });
    res.json(members.map((m) => m.toSafe()));
  })
);

router.post(
  '/members',
  requireRole('admin'),
  validate(staffCreateSchema),
  asyncHandler(async (req, res) => {
    if (await Staff.exists({ email: req.body.email })) throw new HttpError(409, 'Email already in use');
    const m = await Staff.create({
      clinic: req.clinic._id,
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
      passwordHash: await Staff.hashPassword(req.body.password),
    });
    res.status(201).json(m.toSafe());
  })
);

export default router;
