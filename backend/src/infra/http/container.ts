import { JwtAuthService } from '@/application/services/jwt-auth';
import { CheckAuthUseCase } from '@/application/use-cases/check-auth';
import { CompleteTestRunFromCallbackUseCase } from '@/application/use-cases/complete-test-run-from-callback';
import { CreateNewTestCaseUseCase } from '@/application/use-cases/create-new-test-case';
import { CreateNewTestRunUseCase } from '@/application/use-cases/create-new-test-run';
import { CreateUserUseCase } from '@/application/use-cases/create-user';
import { GetTestRunReportUseCase } from '@/application/use-cases/get-test-run-report';
import { LoginUserUseCase } from '@/application/use-cases/login-user';
import { RefreshTokenUseCase } from '@/application/use-cases/refresh-token';
import { env } from '@/infra/config/env';
import { KnexUnitOfWork } from '@/infra/db/knex-unit-of-work';
import { KnexOutboxRepository } from '@/infra/db/repositories/knex-outbox-repository';
import { KnexResultRepository } from '@/infra/db/repositories/knex-result-repository';
import { KnexTestCaseRepository } from '@/infra/db/repositories/knex-test-case-repository';
import { KnexTestRunMetricsRepository } from '@/infra/db/repositories/knex-test-run-metrics-repository';
import { KnexTestRunRepository } from '@/infra/db/repositories/knex-test-run-repository';
import { KnexUserRepository } from '@/infra/db/repositories/knex-user-repository';

export function createContainer() {
  const unitOfWork = new KnexUnitOfWork();
  const userRepository = new KnexUserRepository();
  const testCaseRepository = new KnexTestCaseRepository();
  const testRunRepository = new KnexTestRunRepository();
  const outboxRepository = new KnexOutboxRepository();
  const resultRepository = new KnexResultRepository();
  const testRunMetricsRepository = new KnexTestRunMetricsRepository();
  const jwtAuthService = new JwtAuthService({
    accessSecret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  });

  return {
    createUserUseCase: new CreateUserUseCase(unitOfWork, userRepository),
    loginUserUseCase: new LoginUserUseCase(userRepository, jwtAuthService),
    checkAuthUseCase: new CheckAuthUseCase(jwtAuthService),
    refreshTokenUseCase: new RefreshTokenUseCase(jwtAuthService),
    createNewTestCaseUseCase: new CreateNewTestCaseUseCase(
      unitOfWork,
      testCaseRepository,
      testRunRepository,
      outboxRepository,
    ),
    createNewTestRunUseCase: new CreateNewTestRunUseCase(
      unitOfWork,
      testCaseRepository,
      testRunRepository,
      outboxRepository,
    ),
    completeTestRunFromCallbackUseCase: new CompleteTestRunFromCallbackUseCase(
      unitOfWork,
      testRunRepository,
      resultRepository,
      testCaseRepository,
      testRunMetricsRepository,
    ),
    getTestRunReportUseCase: new GetTestRunReportUseCase(
      testRunMetricsRepository,
    ),
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
