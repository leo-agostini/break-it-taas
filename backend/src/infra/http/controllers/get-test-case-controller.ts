import type { AppContainer } from '@/infra/http/container';
import type { AuthContext } from '@/infra/http/middlewares/authenticator';

export function getTestCaseController(container: AppContainer) {
  return async (testCaseId: UUID, actor: AuthContext) => {
    return container.getTestCaseUseCase.execute(testCaseId, actor);
  };
}
