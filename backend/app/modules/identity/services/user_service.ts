import { normalizeEmail } from '#modules/identity/domain/user_profile';
import User from '#modules/identity/models/user';
import { EmailAlreadyRegisteredError } from '#modules/shared/domain/errors';

export interface SignupInput {
  name: string;
  nickname: string;
  photoUrl?: string;
  email: string;
  password: string;
}

export class UserService {
  async register(input: SignupInput): Promise<User> {
    const email = normalizeEmail(input.email);

    const existing = await User.findBy('email', email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    return User.create({
      name: input.name,
      nickname: input.nickname,
      photoUrl: input.photoUrl ?? null,
      email,
      orgId: null,
      role: null,
      passwordHash: input.password,
    });
  }

  /**
   * Resolves the user for a login attempt. `verifyCredentials` hashes against
   * a dummy value when the email is unknown, so a miss and a wrong password
   * take the same time and fail with the same error.
   */
  async authenticate(email: string, password: string): Promise<User> {
    return User.verifyCredentials(normalizeEmail(email), password);
  }
}
