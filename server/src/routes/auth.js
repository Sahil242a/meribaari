import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import rateLimit from 'express-rate-limit';
import { Clinic } from '../models/Clinic.js';
import { Staff } from '../models/Staff.js';
import { HttpError, asyncHandler, randomKey, slugify } from '../utils/helpers.js';
import { SESSION_COOKIE, setSessionCookie, signSession, validate } from '../middleware/index.js';
import { loginSchema, registerSchema } from './schemas.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

async function uniqueSlug(name) {
  const base = slugify(name) || 'clinic';
  if (!(await Clinic.exists({ slug: base }))) return base;
  return `${base}-${randomKey(2)}`;
}

/** Onboard a new clinic: creates the clinic and its first admin. */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { clinicName, department, address, name, email, password } = req.body;
    if (await Staff.exists({ email })) throw new HttpError(409, 'Is email se account pehle se hai');

    const clinic = await Clinic.create({
      name: clinicName,
      department,
      address,
      slug: await uniqueSlug(clinicName),
    });
    const staff = await Staff.create({
      clinic: clinic._id,
      name,
      email,
      role: 'admin',
      passwordHash: await Staff.hashPassword(password),
    });

    setSessionCookie(res, signSession(staff));
    res.status(201).json({ staff: staff.toSafe(), clinic: clinic.toPublic() });
  })
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const staff = await Staff.findOne({ email: req.body.email }).select('+passwordHash');
    // same message either way so attackers can't discover which emails exist
    if (!staff || !(await staff.checkPassword(req.body.password))) {
      throw new HttpError(401, 'Email ya password galat hai');
    }
    const clinic = await Clinic.findById(staff.clinic);
    setSessionCookie(res, signSession(staff));
    res.json({ staff: staff.toSafe(), clinic: clinic.toPublic() });
  })
);

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

// Returns null (not 401) when logged out, so public pages don't log errors.
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    let claims = null;
    try {
      claims = jwt.verify(req.cookies?.[SESSION_COOKIE] || '', config.jwtSecret);
    } catch {
      return res.json(null);
    }
    const staff = await Staff.findById(claims.sub);
    if (!staff) return res.json(null);
    const clinic = await Clinic.findById(staff.clinic);
    res.json({ staff: staff.toSafe(), clinic: clinic.toPublic() });
  })
);

export default router;
