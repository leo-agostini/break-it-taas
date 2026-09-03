import { ValidationError } from '@/domain/errors/custom-errors';
import { loadProfileDurationSeconds } from '@/domain/services/load-profile-duration';
import type { ExecutionPolicy } from '@/domain/vos/execution-policy';
import type { LoadMode, LoadProfile } from '@/domain/vos/load-profile';

/**
 * Room for the runner pod to start, k6 to boot, and the callback to be posted
 * after the load itself finishes.
 */
export const EXECUTION_GRACE_SECONDS = 30;

/**
 * Guards against a profile that cannot finish inside its own timeout.
 *
 * `executionPolicy.timeoutSeconds` becomes the Job's `activeDeadlineSeconds`,
 * so a timeout shorter than the profile does not fail loudly — Kubernetes just
 * kills the pod partway through and the run reports whatever it managed. This
 * matters most for SOAK, whose whole point is a duration measured in hours.
 */
export function assertTimeoutCoversProfile(
  loadProfile: LoadProfile<LoadMode>,
  executionPolicy: ExecutionPolicy,
): void {
  const profileSeconds = loadProfileDurationSeconds(loadProfile);
  const requiredSeconds = profileSeconds + EXECUTION_GRACE_SECONDS;

  if (executionPolicy.timeoutSeconds < requiredSeconds) {
    throw new ValidationError(
      `Execution timeout of ${executionPolicy.timeoutSeconds}s is too short for a ${profileSeconds}s load profile. ` +
        `Use at least ${requiredSeconds}s so the run is not killed before it finishes.`,
    );
  }
}
