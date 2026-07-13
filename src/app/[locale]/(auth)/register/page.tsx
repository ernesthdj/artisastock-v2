'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';

const schema = z.object({
  tenantName: z.string().min(2, 'Minimum 2 caractères').max(100),
  firstName: z.string().min(1, 'Prénom requis').max(100),
  lastName: z.string().min(1, 'Nom requis').max(100),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Une majuscule requise')
    .regex(/[0-9]/, 'Un chiffre requis'),
  cgv: z.boolean().refine((v) => v, 'Vous devez accepter les CGV'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const password = watch('password', '');
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const onSubmit = async (data: FormData) => {
    try {
      await apiClient.post('/api/v1/auth/register', {
        tenantName: data.tenantName,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_ALREADY_EXISTS') {
          toast.error('Cet email est déjà utilisé');
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Une erreur est survenue');
      }
    }
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="text-green-600" size={32} />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Compte créé !</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Vérifiez votre email pour activer votre compte.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="btn-primary"
        >
          Aller à la connexion
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">Créer mon espace</h1>
      <p className="text-sm text-neutral-500 mb-6">Commencez gratuitement, sans carte bancaire</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
            Nom de votre commerce <span className="text-red-500">*</span>
          </label>
          <input
            {...register('tenantName')}
            type="text"
            placeholder="Boulangerie Dupont"
            className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {errors.tenantName && <p className="mt-1 text-xs text-red-600">{errors.tenantName.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              {...register('firstName')}
              type="text"
              placeholder="Marie"
              className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              {...register('lastName')}
              type="text"
              placeholder="Dupont"
              className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="marie@boulangerie-dupont.be"
            autoComplete="email"
            className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
            Mot de passe <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full h-10 px-3 pr-10 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Indicateur force */}
          {password && (
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= strength
                      ? strength <= 1 ? 'bg-red-500' : strength <= 2 ? 'bg-amber-500' : strength <= 3 ? 'bg-yellow-500' : 'bg-green-500'
                      : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>
          )}
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <label className="flex items-start gap-2 text-sm text-neutral-600 dark:text-slate-400 cursor-pointer">
          <input {...register('cgv')} type="checkbox" className="mt-0.5 rounded border-neutral-300" />
          <span>
            J&apos;accepte les{' '}
            <Link href="/terms" className="text-primary-600 hover:underline">
              conditions générales de vente
            </Link>{' '}
            et la{' '}
            <Link href="/privacy" className="text-primary-600 hover:underline">
              politique de confidentialité
            </Link>
          </span>
        </label>
        {errors.cgv && <p className="text-xs text-red-600">{errors.cgv.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? 'Création...' : 'Créer mon espace'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
