import { describe, expect, it } from 'bun:test';
import { CheckAuthUseCase } from '@/application/use-cases/check-auth';
import { JwtAuthService } from '@/application/services/jwt-auth';

describe('CheckAuthUseCase', () => {
  const jwtAuthService = new JwtAuthService({
    accessSecret: 'test-secret',
    refreshSecret: 'test-refresh-secret',
    accessTtl: '15m',
    refreshTtl: '7d',
  });
  const useCase = new CheckAuthUseCase(jwtAuthService);

  it('returns authenticated user claims from access token', async () => {
    const accessToken = jwtAuthService.issueAccessToken({
      userId: 'adf2e87a-6e4e-4727-930c-f350a0c46b66' as UUID,
      orgId: '550fecf3-0931-4e5a-bdc9-408dc6986fc2' as UUID,
    });

    const result = await useCase.execute(accessToken);

    expect(result.authenticated).toBe(true);
    expect(result.user.id).toBe('adf2e87a-6e4e-4727-930c-f350a0c46b66');
    expect(result.user.orgId).toBe('550fecf3-0931-4e5a-bdc9-408dc6986fc2');
  });
});
