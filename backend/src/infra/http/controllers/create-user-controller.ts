import { newUserSchema } from '@/application/validators/new-user-validator';
import type { AppContainer } from '@/infra/http/container';

export function createUserController(container: AppContainer) {
  return async (body: unknown) => {
    const payload = newUserSchema.parse(body);
    return container.createUserUseCase.execute(payload);
  };
}
