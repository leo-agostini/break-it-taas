import type { AppContainer } from '@/infra/http/container';
import type { AuthContext } from '@/infra/http/middlewares/authenticator';

export function getTestRunController(container: AppContainer) {
  return async (testRunId: UUID, actor: AuthContext) => {
    return container.getTestRunUseCase.execute(testRunId, actor);
  };
}
