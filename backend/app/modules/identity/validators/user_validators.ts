import vine from '@vinejs/vine';
import type { FieldContext } from '@vinejs/vine/types';
import { passwordPolicyViolation } from '#modules/identity/domain/password_policy';

const passwordPolicy = vine.createRule(
  (value: unknown, _options: undefined, field: FieldContext) => {
    if (typeof value !== 'string') return;
    const violation = passwordPolicyViolation(value);
    if (violation) field.report(violation, 'passwordPolicy', field);
  },
);

export const signupValidator = vine.create({
  name: vine.string().trim().minLength(1),
  nickname: vine.string().trim().minLength(3).maxLength(80),
  photoUrl: vine.string().url().optional(),
  email: vine.string().trim().email(),
  password: vine.string().use(passwordPolicy()),
});

export const loginValidator = vine.create({
  email: vine.string().trim().email(),
  password: vine.string().minLength(1),
});
