import router from '@adonisjs/core/services/router';

const HealthController = () =>
  import('#modules/shared/controllers/health_controller');

router.get('/api/health', [HealthController, 'show']);
