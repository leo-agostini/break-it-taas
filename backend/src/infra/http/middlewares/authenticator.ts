import { env } from '@/infra/config/env';
import { AuthenticationError } from '@/domain/errors/custom-errors';
import { JwtAuthService } from '@/application/services/jwt-auth';
import { authCookieNames, getCookieValue } from '@/infra/http/cookies';

export interface AuthContext {
  userId: UUID;
  orgId: UUID | null;
}

const jwtAuthService = new JwtAuthService({
  accessSecret: env.JWT_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessTtl: env.JWT_ACCESS_TTL,
  refreshTtl: env.JWT_REFRESH_TTL,
});

export function authenticateRequest(args: {
  authorizationHeader: string | undefined;
  cookieHeader: string | undefined;
}): AuthContext {
  const cookieToken = getCookieValue(args.cookieHeader, authCookieNames.access);
  if (cookieToken) {
    const claims = jwtAuthService.verifyAccessToken(cookieToken);
    return {
      userId: claims.userId,
      orgId: claims.orgId,
    };
  }

  const authorizationHeader = args.authorizationHeader;
  if (!authorizationHeader) {
    throw new AuthenticationError('Missing access token');
  }
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AuthenticationError('Authorization header must use Bearer token format');
  }
  const claims = jwtAuthService.verifyAccessToken(token);

  return {
    userId: claims.userId,
    orgId: claims.orgId,
  };
}
