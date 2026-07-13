/**
 * Tests d'intégration — Couche Auth
 *
 * Teste la génération/vérification JWT, les helpers password,
 * et parsePagination. Utilise le mock Prisma de setup.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  extractBearerToken,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { parsePagination } from '@/lib/permissions';

// ─── JWT Access Token ────────────────────────────────────────────────────────

describe('generateAccessToken / verifyAccessToken', () => {
  const payload = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    email: 'test@artisa.be',
    role: 'ADMIN',
    sessionId: 'sess-1',
  };

  it('should_generate_and_verify_a_valid_token', () => {
    const token = generateAccessToken(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.sessionId).toBe(payload.sessionId);
  });

  it('should_throw_when_verifying_token_with_wrong_secret', () => {
    const token = generateAccessToken(payload);
    // Falsifier le token (changer la signature)
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('should_throw_when_verifying_an_empty_token', () => {
    expect(() => verifyAccessToken('')).toThrow();
  });

  it('should_throw_when_verifying_a_malformed_token', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });

  it('should_include_tenantId_in_decoded_payload', () => {
    const token = generateAccessToken({ ...payload, tenantId: 'specific-tenant' });
    const decoded = verifyAccessToken(token);
    expect(decoded.tenantId).toBe('specific-tenant');
  });

  it('should_support_null_role', () => {
    const token = generateAccessToken({ ...payload, role: null });
    const decoded = verifyAccessToken(token);
    expect(decoded.role).toBeNull();
  });
});

// ─── JWT Refresh Token ───────────────────────────────────────────────────────

describe('generateRefreshToken / verifyRefreshToken', () => {
  it('should_generate_and_verify_refresh_token', () => {
    const token = generateRefreshToken({ userId: 'user-1', sessionId: 'sess-1' });
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe('user-1');
    expect(decoded.sessionId).toBe('sess-1');
  });

  it('should_reject_access_token_used_as_refresh_token', () => {
    const accessToken = generateAccessToken({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'test@test.be',
      role: null,
      sessionId: 'sess-1',
    });
    // Access token signé avec JWT_SECRET, refresh vérifie JWT_REFRESH_SECRET
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});

// ─── extractBearerToken ──────────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('should_extract_token_from_bearer_header', () => {
    expect(extractBearerToken('Bearer my-token-here')).toBe('my-token-here');
  });

  it('should_return_null_for_null_header', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('should_return_null_for_non_bearer_scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(extractBearerToken('Token abc123')).toBeNull();
  });

  it('should_return_null_for_empty_string', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('should_handle_bearer_with_jwt_token', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.abc123';
    expect(extractBearerToken(`Bearer ${jwt}`)).toBe(jwt);
  });
});

// ─── hashPassword / verifyPassword ──────────────────────────────────────────

describe('hashPassword / verifyPassword', () => {
  it('should_hash_a_password_producing_non_plain_output', async () => {
    const hash = await hashPassword('SecurePass1!');
    expect(hash).not.toBe('SecurePass1!');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });

  it('should_verify_correct_password_against_hash', async () => {
    const hash = await hashPassword('SecurePass1!');
    expect(await verifyPassword('SecurePass1!', hash)).toBe(true);
  });

  it('should_reject_wrong_password', async () => {
    const hash = await hashPassword('SecurePass1!');
    expect(await verifyPassword('WrongPass1!', hash)).toBe(false);
  });

  it('should_produce_different_hashes_for_same_password', async () => {
    const hash1 = await hashPassword('SamePass1!');
    const hash2 = await hashPassword('SamePass1!');
    expect(hash1).not.toBe(hash2); // bcrypt uses random salt
  });

  it('should_not_verify_hash_against_itself', async () => {
    const hash = await hashPassword('SecurePass1!');
    // Ne pas confondre hash avec password
    expect(await verifyPassword(hash, hash)).toBe(false);
  });
});

// ─── parsePagination ────────────────────────────────────────────────────────

describe('parsePagination', () => {
  it('should_return_defaults_when_no_params_provided', () => {
    const result = parsePagination(new URLSearchParams());
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.sortBy).toBe('createdAt');
    expect(result.sortOrder).toBe('desc');
  });

  it('should_parse_explicit_pagination_params', () => {
    const params = new URLSearchParams({ page: '3', pageSize: '10' });
    const result = parsePagination(params);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.skip).toBe(20); // (3-1) × 10
  });

  it('should_clamp_page_to_minimum_1', () => {
    const result = parsePagination(new URLSearchParams({ page: '0' }));
    expect(result.page).toBe(1);

    const result2 = parsePagination(new URLSearchParams({ page: '-5' }));
    expect(result2.page).toBe(1);
  });

  it('should_clamp_pageSize_to_maximum_100', () => {
    const result = parsePagination(new URLSearchParams({ pageSize: '500' }));
    expect(result.pageSize).toBe(100);
  });

  it('should_clamp_pageSize_to_minimum_1', () => {
    const result = parsePagination(new URLSearchParams({ pageSize: '0' }));
    expect(result.pageSize).toBe(1);
  });

  it('should_parse_sort_params', () => {
    const params = new URLSearchParams({ sortBy: 'name', sortOrder: 'asc' });
    const result = parsePagination(params);
    expect(result.sortBy).toBe('name');
    expect(result.sortOrder).toBe('asc');
  });

  it('should_default_sortOrder_to_desc_for_invalid_value', () => {
    const params = new URLSearchParams({ sortOrder: 'invalid' });
    const result = parsePagination(params);
    expect(result.sortOrder).toBe('desc');
  });
});
