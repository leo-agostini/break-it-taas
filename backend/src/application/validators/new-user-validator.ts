import { z } from 'zod';

const hasUppercase = /[A-Z]/;
const hasLowercase = /[a-z]/;
const hasDigit = /\d/;
const hasSymbol = /[^A-Za-z0-9]/;
const hasWhitespace = /\s/;

export const newUserSchema = z
  .object({
    name: z.string().trim().min(1),
    nickname: z.string().trim().min(3).max(80),
    photoUrl: z.url().optional(),
    email: z.email(),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters long')
      .refine((value) => !hasWhitespace.test(value), {
        message: 'Password cannot contain whitespace',
      })
      .refine((value) => hasUppercase.test(value), {
        message: 'Password must contain at least one uppercase letter',
      })
      .refine((value) => hasLowercase.test(value), {
        message: 'Password must contain at least one lowercase letter',
      })
      .refine((value) => hasDigit.test(value), {
        message: 'Password must contain at least one digit',
      })
      .refine((value) => hasSymbol.test(value), {
        message: 'Password must contain at least one symbol',
      }),
  })
  .strict();

export type NewUserInput = z.infer<typeof newUserSchema>;

export const loginUserSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1),
  })
  .strict();

export type LoginUserInput = z.infer<typeof loginUserSchema>;
