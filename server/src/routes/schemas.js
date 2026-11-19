import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^(\+?91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')), {
    message: 'Valid 10-digit Indian mobile number daalein',
  });

export const joinSchema = z.object({
  name: z.string().trim().min(2, 'Naam kam se kam 2 letters ka ho').max(60),
  phone: phone.optional().default(''),
  coords: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const walkInSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  phone: phone.optional().default(''),
  priority: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  clinicName: z.string().trim().min(3).max(80),
  department: z.string().trim().max(60).optional().default(''),
  address: z.string().trim().max(160).optional().default(''),
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const counterActionSchema = z.object({
  counterId: z.string().optional(),
});

export const pauseSchema = z.object({
  paused: z.boolean(),
  message: z.string().max(140).optional(),
});

export const openSchema = z.object({ isOpen: z.boolean() });

export const settingsSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  department: z.string().trim().max(60).optional(),
  address: z.string().trim().max(160).optional(),
  tokenPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,2}$/)
    .optional(),
  defaultServiceMinutes: z.number().int().min(1).max(120).optional(),
  alertWhenAhead: z.number().int().min(1).max(20).optional(),
  maxWaiting: z.number().int().min(1).max(1000).optional(),
  counters: z
    .array(z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(30) }))
    .min(1)
    .max(10)
    .optional(),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
  joinRadiusKm: z.number().min(0).max(100).optional(),
});

export const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'receptionist']).default('receptionist'),
});
