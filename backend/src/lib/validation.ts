import type { Context } from 'hono';
import { z } from 'zod';
import { AppError } from './errors';

/** Parses a JSON body with a zod schema; answers 400 with per-field messages when it fails. */
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError(400, 'BAD_REQUEST', 'The request body must be JSON');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'body';
      fields[key] ??= issue.message;
    }
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', { fields });
  }
  return result.data;
}

/** Parses query parameters with a zod schema; 400 with per-field messages when they don't fit. */
export function readQuery<T extends z.ZodType>(c: Context, schema: T): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues)
      fields[issue.path.join('.') || 'query'] ??= issue.message;
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', { fields });
  }
  return result.data;
}

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

export const nameField = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(60, `${label} is too long`);

export const surnameField = z.string().trim().max(60, 'Surname is too long');

/** 10+ characters, at most 200 (scrypt input), not only spaces. */
export const newPasswordField = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'Use at most 200 characters')
  .refine((value) => value.trim().length >= 10, 'Use at least 10 characters that are not spaces');
