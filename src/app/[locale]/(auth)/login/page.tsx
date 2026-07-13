'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password, data.rememberMe);
      router.push('/dashboard');
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">Connexion</h1>
      <p className="text-sm text-neutral-500 mb-6">Accédez à votre espace artisan</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="vous@exemple.be"
            autoComplete="email"
            className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <span>⚠</span> {errors.email.message}
            </p>
          )}
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
              autoComplete="current-password"
              className="w-full h-10 px-3 pr-10 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">⚠ {errors.password.message}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-slate-400 cursor-pointer">
            <input {...register('rememberMe')} type="checkbox" className="rounded border-neutral-300" />
            Se souvenir de moi (30j)
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Pas encore de compte ?{' '}
        <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
          Créer mon espace
        </Link>
      </p>
    </div>
  );
}
