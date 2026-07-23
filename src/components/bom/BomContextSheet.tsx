'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Plus, Minus } from 'lucide-react';
import { useActivite } from '@/providers/ActiviteProvider';

const schema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  description: z.string().max(500).optional(),
  activiteId: z.string().min(1, 'Activité requise'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingId?: string | null;
  initialData?: { name: string; description?: string | null; activiteId?: string };
}

export function BomContextSheet({ open, onClose, editingId, initialData }: Props) {
  const queryClient = useQueryClient();
  const { activites, activiteId: currentActiviteId } = useActivite();
  // Niveaux de transformation saisis à la création (mirroring FrmBomContexteEdit) — N1 défaut "Ingrédients".
  const [levelNames, setLevelNames] = useState<string[]>(['Ingrédients']);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', activiteId: '' },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name ?? '',
        description: initialData?.description ?? '',
        activiteId: initialData?.activiteId ?? currentActiviteId,
      });
      setLevelNames(['Ingrédients']);
    }
  }, [open, initialData, currentActiviteId, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      editingId
        ? apiClient.patch(`/api/v1/bom/contexts/${editingId}`, data)
        : apiClient.post('/api/v1/bom/contexts', { ...data, levels: levelNames }),
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
            <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Activité <span className="text-red-500">*</span>
            </label>
            <select
              {...register('activiteId')}
              className="px-3 py-2 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">-- Sélectionner une activité --</option>
              {activites.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {errors.activiteId && <p className="text-xs text-red-500">{errors.activiteId.message}</p>}
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
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Niveaux de transformation
              </label>
              {levelNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-6 shrink-0">
                    N{i + 1}
                  </span>
                  <input
                    value={name}
                    onChange={(e) => {
                      const next = [...levelNames];
                      next[i] = e.target.value;
                      setLevelNames(next);
                    }}
                    placeholder={i === 0 ? 'Ingrédients' : `Niveau ${i + 1}`}
                    className="flex-1 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {levelNames.length > 1 && i === levelNames.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setLevelNames(levelNames.slice(0, -1))}
                      className="p-1.5 text-red-400 hover:text-red-600 rounded transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLevelNames([...levelNames, ''])}
                className="flex items-center gap-1 self-start px-2 py-1 text-xs text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors"
              >
                <Plus size={12} /> Ajouter un niveau
              </button>
            </div>
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
