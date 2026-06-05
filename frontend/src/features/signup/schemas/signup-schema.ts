import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  nickname: z.string().min(1, 'Nickname is required.'),
  photoUrl: z.string().url('Photo URL must be valid.').optional().or(z.literal('')),
  email: z.email('Please enter a valid email.'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long.')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one digit.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one symbol.')
    .regex(/^\S+$/, 'Password cannot contain whitespace.'),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
