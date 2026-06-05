import {
  type NewTestCaseInput,
  newTestCaseSchema,
} from '@/application/validators/new-test-case-validator';
import type { AppContainer } from '@/infra/http/container';
import type { AuthContext } from '@/infra/http/middlewares/authenticator';

export function createTestCaseController(container: AppContainer) {
  return async (body: NewTestCaseInput, actor: AuthContext) => {
    const payload = newTestCaseSchema.parse(body);
    return container.createNewTestCaseUseCase.execute(payload, actor);
  };
}
