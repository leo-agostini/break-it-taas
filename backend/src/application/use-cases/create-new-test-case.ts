import { TestCase } from '../../domain/entities/test-case';
import type { TestCaseRepository } from '../repositories/test-case-repository';
import type { TestRunQueue } from '../ports/test-run-queue';
import { TestType } from '../../domain/entities/test-case';
import { LoadProfile, LoadMode, TimeUnit } from '@/domain/vos/load-profile';

export class CreateNewTestCaseUseCase {
  constructor(
    private testCaseRepository: TestCaseRepository,
    private testRunQueue: TestRunQueue,
  ) {}

  async execute(): Promise<void> {
    const loadProfile = LoadProfile.create(LoadMode.CONSTANT, {
      duration: 60,
      targetRate: 200,
      timeUnit: TimeUnit.SECONDS,
    });

    const testCase = TestCase.create({
      name: 'API',
      testType: TestType.STRESS,
      loadProfile,
      steps: [],
    });

    await this.testCaseRepository.create(testCase);
    await this.testRunQueue.publish(testCase.id);
  }
}
