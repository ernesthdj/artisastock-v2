import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
const JWT_REFRESH_REMEMBER_EXPIRES_IN = process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN ?? '30d';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string | null;
  sessionId: string;
}

// ─── Token generation ───────────────────────────────────────────────────────

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function generateRefreshToken(payload: Pick<JwtPayload, 'userId' | 'sessionId'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function generateRefreshTokenLong(payload: Pick<JwtPayload, 'userId' | 'sessionId'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_REMEMBER_EXPIRES_IN } as jwt.SignOptions);
}

// ─── Token verification ─────────────────────────────────────────────────────

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): Pick<JwtPayload, 'userId' | 'sessionId'> {
  return jwt.verify(token, JWT_REFRESH_SECRET) as Pick<JwtPayload, 'userId' | 'sessionId'>;
}

// ─── Password helpers ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Session management ─────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  rememberMe: boolean,
  userAgent?: string,
  ipAddress?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true, role: true },
  });

  if (!user) throw new Error('User not found');

  const sessionId = nanoid();
  const payload: JwtPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role?.name ?? null,
    sessionId,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = rememberMe
    ? generateRefreshTokenLong({ userId: user.id, sessionId })
    : generateRefreshToken({ userId: user.id, sessionId });

  const expiresAt = new Date(
    Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
  );

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      token: accessToken,
      refreshToken,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return { accessToken, refreshToken };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function rotateRefreshToken(
  oldRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  let payload: Pick<JwtPayload, 'userId' | 'sessionId'>;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId, refreshToken: oldRefreshToken },
  });

  if (!session || session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { id: payload.sessionId } });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true },
  });

  if (!user || !user.isActive) return null;

  const newSessionId = nanoid();
  const newPayload: JwtPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role?.name ?? null,
    sessionId: newSessionId,
  };

  const newAccessToken = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken({ userId: user.id, sessionId: newSessionId });

  await prisma.session.update({
    where: { id: session.id },
    data: {
      id: newSessionId,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ─── Extract token from request ─────────────────────────────────────────────

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
