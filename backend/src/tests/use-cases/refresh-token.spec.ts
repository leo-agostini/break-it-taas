import { describe, expect, it } from 'bun:test';
import { JwtAuthService } from '@/application/services/jwt-auth';
import { RefreshTokenUseCase } from '@/application/use-cases/refresh-token';
import { AuthenticationError } from '@/domain/errors/custom-errors';

describe('RefreshTokenUseCase', () => {
  const jwtAuthService = new JwtAuthService({
    accessSecret: 'test-secret',
    refreshSecret: 'test-refresh-secret',
    accessTtl: '15m',
    refreshTtl: '7d',
  });
  const useCase = new RefreshTokenUseCase(jwtAuthService);

  it('rotates refresh token and issues new access token', async () => {
    const refreshToken = jwtAuthService.issueRefreshToken({
      userId: 'ff5a74f0-f286-4cd7-b4ca-ecb80e62cff7' as UUID,
      orgId: null,
    });

    const result = await useCase.execute(refreshToken);

    expect(result.accessToken).toBeString();
    expect(result.refreshToken).toBeString();
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(result.expiresIn).toBe(900);
  });

  it('throws when refresh token is missing', async () => {
    expect(useCase.execute(undefined)).rejects.toThrow(AuthenticationError);
  });
});
