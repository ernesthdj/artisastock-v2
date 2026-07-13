'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { Loader2, Mail } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Email invalide'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await apiClient.post('/api/v1/auth/forgot-password', data);
      setSent(true);
    } catch {
      // Toujours afficher succès pour ne pas révéler les emails
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="text-primary-600" size={32} />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Email envoyé !</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Si un compte existe avec cet email, vous recevrez un lien de réinitialisation sous quelques minutes.
        </p>
        <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
          ← Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">Mot de passe oublié</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>

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
            className="w-full h-10 px-3 rounded-md border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Envoyer le lien
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          ← Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
