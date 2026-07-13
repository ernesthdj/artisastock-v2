import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';
import { verifyAccessToken, extractBearerToken } from './auth';
import type { Permission } from './constants/permissions';

export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  role: string | null;
  sessionId: string;
}

// ─── Middleware auth pour Route Handlers ────────────────────────────────────

export async function withAuth(
  request: NextRequest,
  handler: (ctx: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const token = extractBearerToken(request.headers.get('authorization'));

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } },
      { status: 401 }
    );
  }

  let ctx: AuthContext;
  try {
    const payload = verifyAccessToken(token);
    ctx = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'TOKEN_INVALID', message: 'Token invalide ou expiré' } },
      { status: 401 }
    );
  }

  return handler(ctx);
}

// ─── Middleware auth + permission ───────────────────────────────────────────

export async function withPermission(
  request: NextRequest,
  required: Permission | Permission[],
  handler: (ctx: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (ctx) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      include: { role: true },
    });

    if (!user || user.tenantId !== ctx.tenantId || !user.isActive || user.deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Accès refusé' } },
        { status: 403 }
      );
    }

    // Admin système = toutes les permissions
    if (user.role?.isSystem) {
      return handler(ctx);
    }

    const userPermissions = (user.role?.permissions as string[]) ?? [];
    const requiredPerms = Array.isArray(required) ? required : [required];
    const authorized = requiredPerms.every((p) => userPermissions.includes(p));

    if (!authorized) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission insuffisante' } },
        { status: 403 }
      );
    }

    return handler(ctx);
  });
}

// ─── Réponses API standardisées ─────────────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiCreated<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

export function apiPaginated<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

// ─── Parse pagination params ────────────────────────────────────────────────

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
} {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
  const sortBy = searchParams.get('sortBy') ?? 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  return { page, pageSize, skip: (page - 1) * pageSize, sortBy, sortOrder };
}
