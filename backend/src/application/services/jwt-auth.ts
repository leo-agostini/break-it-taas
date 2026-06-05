import jwt from 'jsonwebtoken';
import { AuthenticationError } from '@/domain/errors/custom-errors';

type AuthTokenType = 'access' | 'refresh';

interface TokenClaims {
  sub: string;
  orgId: UUID | null;
  typ: AuthTokenType;
  jti?: string;
}

interface JwtAuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export class JwtAuthService {
  constructor(private readonly config: JwtAuthConfig) {}

  issueAccessToken(args: { userId: UUID; orgId: UUID | null }) {
    return jwt.sign(
      {
        sub: args.userId,
        orgId: args.orgId,
        typ: 'access',
      } satisfies TokenClaims,
      this.config.accessSecret,
      { expiresIn: this.config.accessTtl },
    );
  }

  issueRefreshToken(args: { userId: UUID; orgId: UUID | null }) {
    return jwt.sign(
      {
        sub: args.userId,
        orgId: args.orgId,
        typ: 'refresh',
        jti: crypto.randomUUID(),
      } satisfies TokenClaims,
      this.config.refreshSecret,
      { expiresIn: this.config.refreshTtl },
    );
  }

  verifyAccessToken(token: string) {
    return this.verify(token, this.config.accessSecret, 'access');
  }

  verifyRefreshToken(token: string) {
    return this.verify(token, this.config.refreshSecret, 'refresh');
  }

  private verify(token: string, secret: string, expectedType: AuthTokenType) {
    let decoded: string | jwt.JwtPayload;

    try {
      decoded = jwt.verify(token, secret);
    } catch {
      throw new AuthenticationError('Invalid or expired authentication token');
    }

    if (typeof decoded === 'string') {
      throw new AuthenticationError('Invalid authentication token payload');
    }

    const subject = decoded.sub;
    if (!subject || typeof subject !== 'string') {
      throw new AuthenticationError('Token subject is missing');
    }

    const tokenType = decoded.typ;
    if (tokenType !== expectedType) {
      throw new AuthenticationError('Unexpected authentication token type');
    }

    const orgIdClaim = decoded.orgId;
    const orgId = typeof orgIdClaim === 'string' ? (orgIdClaim as UUID) : null;

    return {
      userId: subject as UUID,
      orgId,
      typ: expectedType,
    };
  }
}
