import { SignJWT, jwtVerify } from 'jose';
import { ROLES, type AppConfig, type Role } from '../config';

/**
 * Short-lived access tokens (HS256 JWT in an httpOnly cookie). Verification pins the
 * algorithm, issuer and audience, and accepts the previous secret during key rotation.
 */

export interface AccessClaims {
  sub: string;
  sid: string;
  role: Role;
  tv: number;
}

export async function signAccessToken(
  config: AppConfig,
  claims: AccessClaims,
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: claims.sid, role: claims.role, tv: claims.tv })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(config.jwt.issuer)
    .setAudience(config.jwt.audience)
    .setIssuedAt(iat)
    .setExpirationTime(iat + config.jwt.accessTtlSec)
    .sign(config.jwt.secret);
}

export async function verifyAccessToken(
  config: AppConfig,
  token: string,
  now: Date = new Date(),
): Promise<AccessClaims | null> {
  const keys = [config.jwt.secret, config.jwt.previousSecret].filter(
    (key): key is Uint8Array => key instanceof Uint8Array,
  );
  for (const key of keys) {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        clockTolerance: 5,
        currentDate: now,
      });
      const { sub, sid, role, tv } = payload as Record<string, unknown>;
      if (
        typeof sub !== 'string' ||
        typeof sid !== 'string' ||
        typeof tv !== 'number' ||
        !ROLES.includes(role as Role)
      ) {
        return null;
      }
      return { sub, sid, role: role as Role, tv };
    } catch (error) {
      // Only a signature mismatch may be retried with the previous key.
      if ((error as { code?: string }).code !== 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED')
        return null;
    }
  }
  return null;
}
