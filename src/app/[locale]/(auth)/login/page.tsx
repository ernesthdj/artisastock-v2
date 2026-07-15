'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/lib/api-client';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

const S = {
  label: {
    display: 'block',
    fontSize: 12.5, fontWeight: 600,
    color: '#6F4E37', marginBottom: 5,
    letterSpacing: '.01em',
  } as React.CSSProperties,
  input: {
    width: '100%', height: 38, padding: '0 12px',
    borderRadius: 5, border: '1px solid #D4B799',
    background: '#FFFFFF', fontSize: 13.5, color: '#3D2817',
    outline: 'none', transition: 'border-color .15s, box-shadow .15s',
    fontFamily: 'Inter, -apple-system, sans-serif',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  error: {
    marginTop: 4, fontSize: 11.5, color: '#C72C48',
    display: 'flex', alignItems: 'center', gap: 4,
  } as React.CSSProperties,
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'admin@demo-boulangerie.be',
      password: 'Demo1234!',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password, data.rememberMe);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          toast.error('Email ou mot de passe incorrect');
        } else if (err.code === 'EMAIL_NOT_VERIFIED') {
          toast.warning('Vérifiez votre email avant de vous connecter');
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Une erreur est survenue');
      }
    }
  };

  const focusStyle = (field: string): React.CSSProperties =>
    focusedField === field
      ? { borderColor: '#9E7B5C', boxShadow: '0 0 0 2px rgba(158,123,92,0.15)' }
      : {};

  return (
    <div>
      <h1 style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 22, fontWeight: 700, color: '#3D2817',
        marginBottom: 4, marginTop: 0,
      }}>
        Connexion
      </h1>
      <p style={{ fontSize: 13, color: '#9E7B5C', marginBottom: 24, marginTop: 0 }}>
        Accédez à votre espace artisan
      </p>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Email */}
        <div>
          <label style={S.label}>
            Email <span style={{ color: '#C72C48' }}>*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="vous@exemple.be"
            autoComplete="email"
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            style={{ ...S.input, ...focusStyle('email') }}
          />
          {errors.email && (
            <p style={S.error}>⚠ {errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label style={S.label}>
            Mot de passe <span style={{ color: '#C72C48' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              style={{ ...S.input, paddingRight: 38, ...focusStyle('password') }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9E7B5C', display: 'flex', padding: 0,
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && (
            <p style={S.error}>⚠ {errors.password.message}</p>
          )}
        </div>

        {/* Remember me + forgot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#6F4E37', cursor: 'pointer' }}>
            <input {...register('rememberMe')} type="checkbox" style={{ accentColor: '#6F4E37', cursor: 'pointer' }} />
            Se souvenir de moi (30j)
          </label>
          <Link href="/forgot-password" style={{ fontSize: 12.5, color: '#9E7B5C', fontWeight: 600, textDecoration: 'none' }}>
            Mot de passe oublié ?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%', height: 40,
            background: isSubmitting ? '#9E7B5C' : '#3D2817',
            color: '#F5E6D3',
            border: 'none', borderRadius: 5,
            fontSize: 13.5, fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background .15s',
            fontFamily: 'inherit',
            letterSpacing: '.01em',
          }}
          onMouseEnter={e => !isSubmitting && ((e.target as HTMLElement).style.background = '#2C1810')}
          onMouseLeave={e => !isSubmitting && ((e.target as HTMLElement).style.background = '#3D2817')}
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#EAD9C8' }} />
        <span style={{ fontSize: 11, color: '#ACA899', letterSpacing: '.04em' }}>ou</span>
        <div style={{ flex: 1, height: 1, background: '#EAD9C8' }} />
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: '#9E7B5C', margin: 0 }}>
        Pas encore de compte ?{' '}
        <Link href="/register" style={{ color: '#3D2817', fontWeight: 700, textDecoration: 'none' }}>
          Créer mon espace →
        </Link>
      </p>
    </div>
  );
}
