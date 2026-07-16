'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  description: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingId?: string | null;
  initialData?: { name: string; description?: string | null };
}

export function BomContextSheet({ open, onClose, editingId, initialData }: Props) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ name: initialData?.name ?? '', description: initialData?.description ?? '' });
    }
  }, [open, initialData, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      editingId
        ? apiClient.patch(`/api/v1/bom/contexts/${editingId}`, data)
        : apiClient.post('/api/v1/bom/contexts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-contexts'] });
      toast.success(editingId ? 'Contexte mis à jour' : 'Contexte créé');
      onClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Erreur';
      toast.error(message);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        className="relative z-10 flex flex-col w-full max-w-[480px] h-full bg-white dark:bg-[#1a0f0a] shadow-2xl"
        style={{ borderLeft: '1px solid rgba(212,175,55,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/20">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            {editingId ? 'Modifier le contexte' : 'Nouveau contexte BOM'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30">
            <X size={20} className="text-amber-700 dark:text-amber-300" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col flex-1 overflow-y-auto p-6 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              placeholder="Ex : Pâtisserie Fine, Viennoiserie..."
              className="px-3 py-2 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Description optionnelle du contexte de production..."
              className="px-3 py-2 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {!editingId && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded border border-amber-200 dark:border-amber-800">
              Un niveau N0 <strong>Stock ingrédients</strong> sera créé automatiquement.
            </p>
          )}

          <div className="mt-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="flex-1 py-2.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Créer le contexte'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
