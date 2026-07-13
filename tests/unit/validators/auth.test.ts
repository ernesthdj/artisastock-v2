import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '@/lib/validators/auth';

// ─── registerSchema ──────────────────────────────────────────────────────────

describe('registerSchema', () => {
  const validPayload = {
    businessName: 'Boulangerie Dupont',
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean@dupont.be',
    password: 'SecurePass1!',
    locale: 'fr' as const,
  };

  it('should_accept_valid_registration_payload', () => {
    expect(() => registerSchema.parse(validPayload)).not.toThrow();
  });

  it('should_reject_invalid_email', () => {
    expect(() => registerSchema.parse({ ...validPayload, email: 'not-an-email' })).toThrow();
  });

  it('should_reject_password_without_uppercase', () => {
    expect(() => registerSchema.parse({ ...validPayload, password: 'lowercase1!' })).toThrow();
  });

  it('should_reject_password_without_digit', () => {
    expect(() => registerSchema.parse({ ...validPayload, password: 'NoDigitHere!' })).toThrow();
  });

  it('should_reject_password_without_special_char', () => {
    expect(() => registerSchema.parse({ ...validPayload, password: 'NoSpecial1A' })).toThrow();
  });

  it('should_reject_password_shorter_than_8_chars', () => {
    expect(() => registerSchema.parse({ ...validPayload, password: 'Ab1!' })).toThrow();
  });

  it('should_reject_empty_businessName', () => {
    expect(() => registerSchema.parse({ ...validPayload, businessName: '' })).toThrow();
  });

  it('should_default_locale_to_fr_when_omitted', () => {
    const { locale: _, ...withoutLocale } = validPayload;
    const result = registerSchema.parse(withoutLocale);
    expect(result.locale).toBe('fr');
  });

  it('should_accept_nl_locale', () => {
    const result = registerSchema.parse({ ...validPayload, locale: 'nl' });
    expect(result.locale).toBe('nl');
  });

  it('should_reject_invalid_locale', () => {
    expect(() => registerSchema.parse({ ...validPayload, locale: 'en' })).toThrow();
  });
});

// ─── loginSchema ─────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('should_accept_valid_login_payload', () => {
    expect(() =>
      loginSchema.parse({ email: 'test@test.be', password: 'any', rememberMe: false })
    ).not.toThrow();
  });

  it('should_reject_empty_password', () => {
    expect(() => loginSchema.parse({ email: 'test@test.be', password: '' })).toThrow();
  });

  it('should_reject_invalid_email', () => {
    expect(() => loginSchema.parse({ email: 'not-email', password: 'pass' })).toThrow();
  });

  it('should_default_rememberMe_to_false', () => {
    const result = loginSchema.parse({ email: 'test@test.be', password: 'pass' });
    expect(result.rememberMe).toBe(false);
  });
});

// ─── forgotPasswordSchema ────────────────────────────────────────────────────

describe('forgotPasswordSchema', () => {
  it('should_accept_valid_email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'test@test.be' })).not.toThrow();
  });

  it('should_reject_invalid_email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'nope' })).toThrow();
  });
});

// ─── resetPasswordSchema ─────────────────────────────────────────────────────

describe('resetPasswordSchema', () => {
  it('should_accept_valid_reset_payload', () => {
    expect(() =>
      resetPasswordSchema.parse({ token: 'abc123', password: 'NewSecure1!' })
    ).not.toThrow();
  });

  it('should_reject_empty_token', () => {
    expect(() =>
      resetPasswordSchema.parse({ token: '', password: 'NewSecure1!' })
    ).toThrow();
  });

  it('should_enforce_password_strength_on_reset', () => {
    expect(() =>
      resetPasswordSchema.parse({ token: 'abc', password: 'weak' })
    ).toThrow();
  });
});

// ─── changePasswordSchema ────────────────────────────────────────────────────

describe('changePasswordSchema', () => {
  it('should_accept_valid_change_payload', () => {
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' })
    ).not.toThrow();
  });

  it('should_reject_weak_new_password', () => {
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'OldPass1!', newPassword: 'weak' })
    ).toThrow();
  });
});

// ─── updateProfileSchema ─────────────────────────────────────────────────────

describe('updateProfileSchema', () => {
  it('should_accept_partial_update', () => {
    expect(() => updateProfileSchema.parse({ firstName: 'Jean' })).not.toThrow();
    expect(() => updateProfileSchema.parse({ locale: 'nl' })).not.toThrow();
    expect(() => updateProfileSchema.parse({})).not.toThrow();
  });

  it('should_reject_firstName_longer_than_100_chars', () => {
    expect(() =>
      updateProfileSchema.parse({ firstName: 'a'.repeat(101) })
    ).toThrow();
  });

  it('should_reject_invalid_locale', () => {
    expect(() => updateProfileSchema.parse({ locale: 'de' })).toThrow();
  });
});
