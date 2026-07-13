import { vi } from 'vitest';

// Mock Prisma — éviter la connexion DB dans les tests unitaires
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ingredient: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    recipe: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    recipeIngredient: { findMany: vi.fn() },
    order: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
  getPrismaWithTenant: vi.fn(() => ({
    ingredient: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    recipe: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    product: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  })),
}));

// Mock next/server pour les tests API
vi.mock('next/server', () => ({
  NextRequest: class {
    headers = new Map();
    nextUrl = { searchParams: new URLSearchParams() };
    json() { return Promise.resolve({}); }
    text() { return Promise.resolve(''); }
  },
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({ data, status: init?.status ?? 200 }),
  },
}));

// Variables d'env minimales
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters-long';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake';
process.env.RESEND_API_KEY = 're_test_fake';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
