import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { config, isProd } from '../config.js';
import { HttpError } from '../utils/helpers.js';

export const SESSION_COOKIE = 'mb_session';

export function signSession(staff) {
  return jwt.sign({ sub: staff._id.toString(), clinic: staff.clinic.toString(), role: staff.role }, config.jwtSecret, {
    expiresIn: '12h',
  });
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, // JS can't read it -> safe from XSS token theft
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function requireStaff(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next(new HttpError(401, 'Login required'));
  try {
    req.staff = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please login again'));
  }
}

export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.staff?.role) ? next() : next(new HttpError(403, 'Not allowed for your role'));

/** Validate req.body / req.query with a zod schema; parsed data replaces the original. */
export const validate =
  (schema, where = 'body') =>
  (req, _res, next) => {
    try {
      req[where] = schema.parse(req[where]);
      next();
    } catch (err) {
      next(err);
    }
  };

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Route not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: err.issues[0]?.message || 'Invalid input',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Already exists' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message, ...err.extra });
}
