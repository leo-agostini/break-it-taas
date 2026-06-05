import type { UserRepository } from '@/application/repositories/user-repository';
import type { JwtAuthService } from '@/application/services/jwt-auth';
import {
  type LoginUserInput,
  loginUserSchema,
} from '@/application/validators/new-user-validator';
import { AuthenticationError } from '@/domain/errors/custom-errors';
import { verifyPassword } from '@/domain/services/password-hasher';

interface LoginUserOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: UUID;
    name: string;
    email: string;
    orgId: UUID | null;
  };
}

export class LoginUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private jwtAuthService: JwtAuthService,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const payload = loginUserSchema.parse(input);
    const normalizedEmail = payload.email.trim().toLowerCase();

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    const isValidPassword = await verifyPassword(
      payload.password,
      user.passwordHash,
    );
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    const accessToken = this.jwtAuthService.issueAccessToken({
      userId: user.id,
      orgId: user.orgId,
    });
    const refreshToken = this.jwtAuthService.issueRefreshToken({
      userId: user.id,
      orgId: user.orgId,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        orgId: user.orgId,
      },
    };
  }
}
