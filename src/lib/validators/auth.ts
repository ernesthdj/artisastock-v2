import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 caractères')
  .regex(/[A-Z]/, 'Au moins une majuscule')
  .regex(/[0-9]/, 'Au moins un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial');

export const registerSchema = z.object({
  businessName: z.string().min(1).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: passwordSchema,
  locale: z.enum(['fr', 'nl']).default('fr'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  locale: z.enum(['fr', 'nl']).optional(),
});
