import { AuthenticationError } from '@/domain/errors/custom-errors';
import type { JwtAuthService } from '@/application/services/jwt-auth';

export class RefreshTokenUseCase {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  async execute(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new AuthenticationError('Missing refresh token');
    }

    const claims = this.jwtAuthService.verifyRefreshToken(refreshToken);

    const accessToken = this.jwtAuthService.issueAccessToken({
      userId: claims.userId,
      orgId: claims.orgId,
    });
    const rotatedRefreshToken = this.jwtAuthService.issueRefreshToken({
      userId: claims.userId,
      orgId: claims.orgId,
    });

    return {
      accessToken,
      refreshToken: rotatedRefreshToken,
      expiresIn: 900,
    };
  }
}
