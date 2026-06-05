import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { UserRepository } from '@/application/repositories/user-repository';
import type { User } from '@/domain/entities/user';

export class InMemoryUserRepository implements UserRepository {
  items = new Map<string, User>();

  async findByEmail(
    email: string,
    _tx?: TransactionContext,
  ): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    for (const user of this.items.values()) {
      if (user.email === normalizedEmail) return user;
    }
    return null;
  }

  async create(user: User, _tx?: TransactionContext): Promise<void> {
    this.items.set(user.id, user);
  }
}
