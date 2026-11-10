import router from '@adonisjs/core/services/router';
import { middleware } from '#start/kernel';

const UsersController = () =>
  import('#modules/identity/controllers/users_controller');
const SessionController = () =>
  import('#modules/identity/controllers/session_controller');

router
  .group(() => {
    router.post('/users', [UsersController, 'store']);
    router.post('/login', [SessionController, 'store']);
    router.post('/auth/logout', [SessionController, 'destroy']);
    router
      .get('/auth/check', [SessionController, 'show'])
      .use(middleware.auth());
  })
  .prefix('/api');
