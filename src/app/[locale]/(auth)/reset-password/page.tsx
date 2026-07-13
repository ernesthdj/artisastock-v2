'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';

const schema = z.object({
  password: z.string().min(8, 'Minimum 8 caractères').regex(/[A-Z]/, 'Une majuscule requise').regex(/[0-9]/, 'Un chiffre requis'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) { toast.error('Lien invalide ou expiré'); return; }
    try {
      await apiClient.post(`/api/v1/auth/reset-password`, { token, password: data.password });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TOKEN_EXPIRED') toast.error('Lien expiré, demandez-en un nouveau');
        else toast.error(err.message);
      }
    }
  };

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600 text-sm mb-4">Lien de réinitialisation invalide.</p>
        <Link href="/forgot-password" className="text-primary-600 hover:underline text-sm">Demander un nouveau lien</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="text-green-600" size={32} />
        </div>
        <h2 className="text-xl font-semibold mb-2">Mot de passe réinitialisé</h2>
        <p className="text-sm text-neutral-500 mb-6">Vous pouvez maintenant vous connecter.</p>
        <button onClick={() => router.push('/login')} className="btn-primary">Se connecter</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">Nouveau mot de passe</h1>
      <p className="text-sm text-neutral-500 mb-6">Choisissez un mot de passe sécurisé.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
            Nouveau mot de passe <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              className="w-full h-10 px-3 pr-10 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1">
            Confirmer <span className="text-red-500">*</span>
          </label>
          <input
            {...register('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full h-10 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Réinitialiser
        </button>
      </form>
    </div>
  );
}
