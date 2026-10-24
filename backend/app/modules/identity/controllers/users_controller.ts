import { inject } from '@adonisjs/core';
import type { HttpContext } from '@adonisjs/core/http';
import { presentCreatedUser } from '#modules/identity/presenters/user_presenter';
import type { UserService } from '#modules/identity/services/user_service';
import { signupValidator } from '#modules/identity/validators/user_validators';

@inject()
export default class UsersController {
  constructor(private readonly users: UserService) {}

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(signupValidator);
    const user = await this.users.register(payload);

    response.status(201);
    return presentCreatedUser(user);
  }
}
