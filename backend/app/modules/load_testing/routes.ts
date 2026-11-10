import router from '@adonisjs/core/services/router';
import { middleware } from '#start/kernel';

const TestCasesController = () =>
  import('#modules/load_testing/controllers/test_cases_controller');
const TestRunsController = () =>
  import('#modules/load_testing/controllers/test_runs_controller');
const RunnerCallbackController = () =>
  import('#modules/load_testing/controllers/runner_callback_controller');

router
  .group(() => {
    router.post('/test-cases', [TestCasesController, 'store']);
    router.get('/test-cases', [TestCasesController, 'index']);
    router.get('/test-cases/:testCaseId', [TestCasesController, 'show']);
    router.get('/test-cases/:testCaseId/runs', [TestRunsController, 'index']);

    router.post('/test-runs/:testCaseId', [TestRunsController, 'store']);
    router.get('/test-runs/:testRunId', [TestRunsController, 'show']);
    router.get('/test-runs/:testRunId/report', [TestRunsController, 'report']);
  })
  .prefix('/api')
  .where('testCaseId', router.matchers.uuid())
  .where('testRunId', router.matchers.uuid())
  .use(middleware.auth());

router.post('/api/internal/test-runs/callback', [
  RunnerCallbackController,
  'store',
]);
