import type { TestCase } from '../../domain/entities/test-case';

export interface TestCaseRepository {
  find(id: string): Promise<TestCase | null>;
  create(testCase: TestCase): Promise<void>;
}
