import { beforeEach, describe, expect, it } from 'bun:test';
import { LoginUserUseCase } from '@/application/use-cases/login-user';
import { CreateUserUseCase } from '@/application/use-cases/create-user';
import { AuthenticationError } from '@/domain/errors/custom-errors';
import { InMemoryUnitOfWork } from '@/tests/mocks/in-memory-unit-of-work';
import { InMemoryUserRepository } from '@/tests/mocks/in-memory-user-repository';
import { makeValidNewUserInput } from '@/tests/fixtures/user-fixtures';
import { JwtAuthService } from '@/application/services/jwt-auth';

describe('LoginUserUseCase', () => {
  const userRepository = new InMemoryUserRepository();
  const createUserUseCase = new CreateUserUseCase(
    new InMemoryUnitOfWork(),
    userRepository,
  );
  const jwtAuthService = new JwtAuthService({
    accessSecret: 'test-secret',
    refreshSecret: 'test-refresh-secret',
    accessTtl: '15m',
    refreshTtl: '7d',
  });
  const loginUserUseCase = new LoginUserUseCase(userRepository, jwtAuthService);

  beforeEach(() => {
    userRepository.items.clear();
  });

  it('returns access and refresh tokens for valid credentials', async () => {
    await createUserUseCase.execute(makeValidNewUserInput());

    const result = await loginUserUseCase.execute({
      email: 'alice@example.com',
      password: 'StrongPass123!',
    });

    expect(result.accessToken).toBeString();
    expect(result.accessToken.length).toBeGreaterThan(10);
    expect(result.refreshToken).toBeString();
    expect(result.refreshToken.length).toBeGreaterThan(10);
    expect(result.user.email).toBe('alice@example.com');
  });

  it('throws when password is invalid', async () => {
    await createUserUseCase.execute(makeValidNewUserInput());

    expect(
      loginUserUseCase.execute({
        email: 'alice@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(AuthenticationError);
  });
});
