import { inject } from '@adonisjs/core';
import type { HttpContext } from '@adonisjs/core/http';
import { presentSessionUser } from '#modules/identity/presenters/user_presenter';
import { UserService } from '#modules/identity/services/user_service';
import { loginValidator } from '#modules/identity/validators/user_validators';

/**
 * Session auth (ADR-008). The session cookie is the credential; there are no
 * tokens to issue or refresh.
 */
@inject()
export default class SessionController {
  constructor(private readonly users: UserService) {}

  async store({ request, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator);
    const user = await this.users.authenticate(email, password);

    // Regenerates the session id, so a pre-login session cannot be fixated.
    await auth.use('web').login(user);

    return { user: presentSessionUser(user) };
  }

  async show({ auth }: HttpContext) {
    const user = auth.getUserOrFail();
    return {
      authenticated: true,
      user: {
        id: user.id,
        orgId: user.orgId ?? null,
      },
    };
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout();
    return response.noContent();
  }
}
