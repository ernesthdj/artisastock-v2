'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { Select } from '@/components/ui';

const schema = z.object({
  email: z.string().email('Email invalide'),
  roleId: z.string().min(1, 'Rôle requis'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteCollaboratorSheet({ open, onClose }: Props) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', roleId: '' },
  });

  const { data: roles } = useQuery({
    queryKey: ['team-roles'],
    queryFn: async () => {
      const res = await apiClient.get<{ id: string; name: string }[]>('/api/v1/roles?pageSize=100');
      return res.data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) reset({ email: '', roleId: '' });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiClient.post('/api/v1/users', data),
    onSuccess: () => {
      toast.success('Invitation envoyée');
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        toast.error('Un compte avec cet email existe déjà');
      } else {
        toast.error(err instanceof Error ? err.message : 'Une erreur est survenue');
      }
    },
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <h2 className="text-erp-lg font-semibold text-choco-600">Inviter un collaborateur</h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">
              Email <span className="text-framboise-400">*</span>
            </label>
            <input {...register('email')} type="email" placeholder="marie@exemple.be" className="form-input" />
            {errors.email && <p className="mt-1 text-erp-xs text-framboise-400">{errors.email.message}</p>}
            <p className="mt-1 text-erp-xs text-neutral-500">
              Un email lui sera envoyé pour choisir son mot de passe et activer son compte.
            </p>
          </div>

          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">
              Rôle <span className="text-framboise-400">*</span>
            </label>
            <Select
              {...register('roleId')}
              options={[{ value: '', label: 'Sélectionner un rôle' }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))]}
            />
            {errors.roleId && <p className="mt-1 text-erp-xs text-framboise-400">{errors.roleId.message}</p>}
          </div>
        </form>

        <div className="px-6 py-4 border-t border-[var(--line-1)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[var(--line-2)] rounded-[var(--rx-input)] text-erp-sm font-medium text-choco-600 hover:bg-[var(--surface-hover)] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit((d) => mutation.mutate(d))}
            disabled={isSubmitting || mutation.isPending}
            className="flex-1 h-10 bg-choco-600 hover:bg-choco-700 text-[#FCF8EF] text-erp-sm font-medium rounded-[var(--rx-input)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {(isSubmitting || mutation.isPending) && <Loader2 size={14} className="animate-spin" />}
            Envoyer l&apos;invitation
          </button>
        </div>
      </div>
    </>
  );
}
