import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { User } from '@/domain/entities/user';

export interface UserRepository {
  findByEmail(email: string, tx?: TransactionContext): Promise<User | null>;
  create(user: User, tx?: TransactionContext): Promise<void>;
}
