import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../utils/helpers.js';
import { validate } from '../middleware/index.js';
import { joinSchema } from './schemas.js';
import * as queue from '../services/queueService.js';

const router = Router();

// Stops one person (or bot) from flooding a clinic with fake tokens.
const joinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.JOIN_RATE_LIMIT) || 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Bahut saare tokens le liye. 10 minute baad try karein.' },
});

router.get(
  '/clinics/:slug',
  asyncHandler(async (req, res) => {
    const clinic = await queue.getClinicBySlug(req.params.slug);
    const state = await queue.computeState(clinic);
    res.json(queue.toPublicState(clinic, state));
  })
);

router.post(
  '/clinics/:slug/tokens',
  joinLimiter,
  validate(joinSchema),
  asyncHandler(async (req, res) => {
    const clinic = await queue.getClinicBySlug(req.params.slug);
    const { token, accessKey } = await queue.issueToken(clinic, { ...req.body, source: 'online' });
    const view = await queue.tokenView(token._id);
    res.status(201).json({ ...view, accessKey });
  })
);

router.get(
  '/tokens/:id',
  asyncHandler(async (req, res) => {
    res.json(await queue.tokenView(req.params.id));
  })
);

router.post(
  '/tokens/:id/cancel',
  validate(z.object({ accessKey: z.string().min(10) })),
  asyncHandler(async (req, res) => {
    await queue.cancelByPatient(req.params.id, req.body.accessKey);
    res.json(await queue.tokenView(req.params.id));
  })
);

export default router;
