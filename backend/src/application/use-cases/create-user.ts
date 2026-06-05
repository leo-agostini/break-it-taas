import type { UnitOfWork } from '@/application/ports/unit-of-work';
import type { UserRepository } from '@/application/repositories/user-repository';
import { newUserSchema } from '@/application/validators/new-user-validator';
import { User, type UserRole } from '@/domain/entities/user';
import { EmailAlreadyRegisteredError } from '@/domain/errors/custom-errors';
import { hashPassword } from '@/domain/services/password-hasher';

interface CreatedUserOutput {
  id: UUID;
  name: string;
  nickname: string;
  photoUrl: string | null;
  email: string;
  orgId: UUID | null;
  role: UserRole | null;
  createdAt: Date;
}

export class CreateUserUseCase {
  constructor(
    private unitOfWork: UnitOfWork,
    private userRepository: UserRepository,
  ) {}

  async execute(input: unknown): Promise<CreatedUserOutput> {
    const payload = newUserSchema.parse(input);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await hashPassword(payload.password);

    const user = await this.unitOfWork.transaction(async (tx) => {
      const createdUser = User.create({
        name: payload.name,
        nickname: payload.nickname,
        photoUrl: payload.photoUrl ?? null,
        email: normalizedEmail,
        orgId: null,
        role: null,
        passwordHash,
      });

      await this.userRepository.create(createdUser, tx);
      return createdUser;
    });

    return {
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      photoUrl: user.photoUrl,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
