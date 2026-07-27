'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { useAuth } from '@/providers/AuthProvider';
import { passwordSchema } from '@/lib/validators/auth';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis').max(100),
  lastName: z.string().min(1, 'Nom requis').max(100),
  password: passwordSchema,
});

type FormData = z.infer<typeof schema>;

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const locale = useLocale();
  const { refetch } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

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
      const res = await apiClient.post<{ accessToken: string; refreshToken: string }>(
        `/api/v1/users/accept-invite/${token}`,
        data
      );
      localStorage.setItem('access_token', res.data.accessToken);
      localStorage.setItem('refresh_token', res.data.refreshToken);
      await refetch();
      toast.success('Compte activé !');
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TOKEN_EXPIRED') {
          toast.error('Cette invitation a expiré — demandez-en une nouvelle');
        } else if (err.code === 'ALREADY_ACCEPTED') {
          toast.error('Cette invitation a déjà été acceptée — connectez-vous directement');
        } else if (err.code === 'INVALID_TOKEN') {
          toast.error('Invitation invalide');
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
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">Rejoindre l&apos;équipe</h1>
      <p className="text-sm text-neutral-500 mb-6">Choisissez votre mot de passe pour activer votre compte</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              {...register('firstName')}
              type="text"
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
              className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
          </div>
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? 'Activation...' : 'Activer mon compte'}
        </button>
      </form>
    </div>
  );
}
