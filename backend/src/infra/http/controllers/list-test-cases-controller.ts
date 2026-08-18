import type { AppContainer } from '@/infra/http/container';
import type { AuthContext } from '@/infra/http/middlewares/authenticator';

export function listTestCasesController(container: AppContainer) {
  return async (actor: AuthContext) => {
    return container.listTestCasesUseCase.execute(actor);
  };
}
