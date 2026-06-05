import type { JwtAuthService } from '@/application/services/jwt-auth';

export class CheckAuthUseCase {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  async execute(accessToken: string) {
    const claims = this.jwtAuthService.verifyAccessToken(accessToken);
    return {
      authenticated: true,
      user: {
        id: claims.userId,
        orgId: claims.orgId,
      },
    };
  }
}
