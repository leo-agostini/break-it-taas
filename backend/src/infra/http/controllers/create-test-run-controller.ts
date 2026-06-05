import type { AppContainer } from '@/infra/http/container';
import type { AuthContext } from '@/infra/http/middlewares/authenticator';

export function createTestRunController(container: AppContainer) {
  return async (testCaseId: UUID, actor: AuthContext) => {
    return container.createNewTestRunUseCase.execute(testCaseId, actor);
  };
}
