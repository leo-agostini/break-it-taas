import type { TestCase } from '../../domain/entities/test-case';
import type { TransactionContext } from '../ports/unit-of-work';

export interface TestCaseRepository {
  find(id: string): Promise<TestCase | null>;
  create(testCase: TestCase, tx?: TransactionContext): Promise<void>;
}
