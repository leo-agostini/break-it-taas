import { ValidationError } from '@/domain/errors/custom-errors';
import { randomUUIDv7 } from 'bun';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

interface UserConstructorArgs {
  id: UUID;
  name: string;
  nickname: string;
  photoUrl: string | null;
  email: string;
  orgId: UUID | null;
  role: UserRole | null;
  passwordHash: string;
  createdAt: Date;
}

export class User {
  id: UUID;
  name: string;
  nickname: string;
  photoUrl: string | null;
  email: string;
  orgId: UUID | null;
  role: UserRole | null;
  passwordHash: string;
  createdAt: Date;

  constructor(args: UserConstructorArgs) {
    if (!args.name.trim()) throw new ValidationError('User name is required');
    if (!args.nickname.trim()) {
      throw new ValidationError('User nickname is required');
    }
    if (!args.email.trim()) throw new ValidationError('User email is required');
    if (!args.passwordHash.trim()) {
      throw new ValidationError('Password hash is required');
    }

    this.id = args.id;
    this.name = args.name.trim();
    this.nickname = args.nickname.trim();
    this.photoUrl = args.photoUrl;
    this.email = User.normalizeEmail(args.email);
    this.orgId = args.orgId;
    this.role = args.role;
    this.passwordHash = args.passwordHash;
    this.createdAt = args.createdAt;
  }

  static create(args: {
    name: string;
    nickname: string;
    photoUrl?: string | null;
    email: string;
    orgId?: UUID | null;
    role?: UserRole | null;
    passwordHash: string;
  }) {
    return new User({
      id: randomUUIDv7(),
      name: args.name,
      nickname: args.nickname,
      photoUrl: args.photoUrl ?? null,
      email: args.email,
      orgId: args.orgId ?? null,
      role: args.role ?? null,
      passwordHash: args.passwordHash,
      createdAt: new Date(),
    });
  }

  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
