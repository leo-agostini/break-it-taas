import { TestType } from '@/domain/entities/test-case';
import { LoadProfileCompatibilityError } from '@/domain/errors/custom-errors';
import { LoadMode } from '@/domain/vos/load-profile';

const compatibility: Record<TestType, LoadMode[]> = {
  [TestType.SMOKE]: [LoadMode.CONSTANT],
  [TestType.AVG_LOAD]: [LoadMode.CONSTANT, LoadMode.RAMP],
  [TestType.STRESS]: [LoadMode.CONSTANT, LoadMode.RAMP],
  [TestType.SOAK]: [LoadMode.CONSTANT],
  [TestType.SPIKE]: [LoadMode.RAMP],
  [TestType.BREAKPOINT]: [LoadMode.RAMP],
};

export function assertCompatibleLoadProfile(
  testType: TestType,
  mode: LoadMode,
): void {
  const allowedModes = compatibility[testType];
  if (!allowedModes.includes(mode)) {
    throw new LoadProfileCompatibilityError(
      `Load profile mode ${mode} is not compatible with test type ${testType}`,
    );
  }
}
