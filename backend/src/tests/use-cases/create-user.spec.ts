import { beforeEach, describe, expect, it } from 'bun:test';
import { CreateUserUseCase } from '@/application/use-cases/create-user';
import { EmailAlreadyRegisteredError } from '@/domain/errors/custom-errors';
import { makeValidNewUserInput } from '@/tests/fixtures/user-fixtures';
import { InMemoryUnitOfWork } from '@/tests/mocks/in-memory-unit-of-work';
import { InMemoryUserRepository } from '@/tests/mocks/in-memory-user-repository';

describe('CreateUserUseCase', () => {
  const userRepository = new InMemoryUserRepository();
  const useCase = new CreateUserUseCase(
    new InMemoryUnitOfWork(),
    userRepository,
  );

  beforeEach(() => {
    userRepository.items.clear();
  });

  it('creates a user and returns a safe dto', async () => {
    const result = await useCase.execute(makeValidNewUserInput());
    const persistedUser = userRepository.items.get(result.id);

    expect(result.email).toBe('alice@example.com');
    expect(result.nickname).toBe('alice');
    expect(result.photoUrl).toBe('https://example.com/alice.png');
    expect(result.orgId).toBeNull();
    expect(result.role).toBeNull();
    expect(persistedUser).toBeDefined();
    expect(persistedUser?.passwordHash).not.toBe('StrongPass123!');
    expect('passwordHash' in result).toBe(false);
  });

  it('throws when email is already registered', async () => {
    await useCase.execute(makeValidNewUserInput());

    expect(useCase.execute(makeValidNewUserInput())).rejects.toThrow(
      EmailAlreadyRegisteredError,
    );
  });

  it('throws when password has less than 12 characters', async () => {
    expect(
      useCase.execute(makeValidNewUserInput({ password: 'Ab1!short' })),
    ).rejects.toThrow('Password must be at least 12 characters long');
  });

  it('throws when password has no uppercase letter', async () => {
    expect(
      useCase.execute(makeValidNewUserInput({ password: 'lowercase123!' })),
    ).rejects.toThrow('Password must contain at least one uppercase letter');
  });

  it('throws when password has no lowercase letter', async () => {
    expect(
      useCase.execute(makeValidNewUserInput({ password: 'UPPERCASE123!' })),
    ).rejects.toThrow('Password must contain at least one lowercase letter');
  });

  it('throws when password has no digit', async () => {
    expect(
      useCase.execute(makeValidNewUserInput({ password: 'NoDigitsHere!!' })),
    ).rejects.toThrow('Password must contain at least one digit');
  });

  it('throws when password has no symbol', async () => {
    expect(
      useCase.execute(makeValidNewUserInput({ password: 'NoSymbol12345' })),
    ).rejects.toThrow('Password must contain at least one symbol');
  });

  it('throws when password contains whitespace', async () => {
    expect(
      useCase.execute(makeValidNewUserInput({ password: 'Has Space123!' })),
    ).rejects.toThrow('Password cannot contain whitespace');
  });

  it('throws when payload includes unknown fields', async () => {
    expect(
      useCase.execute({
        ...makeValidNewUserInput(),
        role: 'OWNER',
      }),
    ).rejects.toThrow('unrecognized_keys');
  });
});
