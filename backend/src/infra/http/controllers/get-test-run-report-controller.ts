import type { AppContainer } from '@/infra/http/container';
import type { AuthContext } from '@/infra/http/middlewares/authenticator';

export function getTestRunReportController(container: AppContainer) {
  return async (testRunId: UUID, actor: AuthContext) => {
    return container.getTestRunReportUseCase.execute(testRunId, actor);
  };
}
