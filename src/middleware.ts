import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { extractBearerToken } from '@/lib/auth';

const LOCALES = ['fr', 'nl'] as const;
const DEFAULT_LOCALE = 'fr';

// Routes publiques qui ne nécessitent pas d'auth
const PUBLIC_API_ROUTES = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/refresh',
  '/api/webhooks/stripe',
]);

const PUBLIC_API_PREFIXES = ['/api/v1/storefront/', '/api/storefront/'];

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});

// ─── Vérification JWT Edge-compatible (Web Crypto API) ────────────────────────
interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string | null;
  sessionId: string;
  exp?: number;
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function verifyJwtEdge(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);

    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));

    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ─── Webhooks Stripe — bypass total ──────────────────────────────────────
  if (pathname === '/api/webhooks/stripe') {
    return NextResponse.next();
  }

  // ─── Routes API v1 ────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Routes publiques — pas d'auth requise
    if (
      PUBLIC_API_ROUTES.has(pathname) ||
      PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    ) {
      return NextResponse.next();
    }

    // Routes protégées — vérification JWT (Edge-compatible)
    const token = extractBearerToken(request.headers.get('authorization'));

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } },
        { status: 401 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET ?? '';
    const payload = await verifyJwtEdge(token, jwtSecret);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_INVALID', message: 'Token invalide ou expiré' } },
        { status: 401 }
      );
    }

    // Injection des infos dans les headers pour les Route Handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-tenant-id', payload.tenantId);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role ?? '');
    requestHeaders.set('x-session-id', payload.sessionId);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ─── Routes pages — gestion i18n ─────────────────────────────────────────
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Routes API
    '/api/(.*)',
    // Routes i18n — exclure _next/static, _next/image, favicon, etc.
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
