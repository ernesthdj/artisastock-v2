'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { PERMISSION_GROUPS, PERMISSIONS, type Permission } from '@/lib/constants/permissions';

const schema = z.object({
  name: z.string().min(1, 'Requis').max(100),
  description: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

interface RoleData {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editingRole: RoleData | null;
}

export function RoleSheet({ open, onClose, editingRole }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!editingRole;
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (open) {
      reset(isEdit ? { name: editingRole.name, description: editingRole.description ?? '' } : { name: '', description: '' });
      setPermissions(new Set(isEdit ? (editingRole.permissions as Permission[]) : []));
    }
  }, [open, isEdit, editingRole, reset]);

  const togglePermission = (key: Permission) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data, permissions: [...permissions] };
      return isEdit
        ? apiClient.patch(`/api/v1/roles/${editingRole.id}`, payload)
        : apiClient.post('/api/v1/roles', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roles'] });
      toast.success(isEdit ? 'Rôle modifié' : 'Rôle créé');
      onClose();
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <h2 className="text-erp-lg font-semibold text-choco-600">{isEdit ? 'Modifier le rôle' : 'Nouveau rôle'}</h2>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {isEdit && editingRole.isSystem && (
            <p className="text-erp-xs text-or-600 bg-[#FBF1CC] border border-or-400 rounded-[var(--rx-input)] px-3 py-2">
              Rôle système — retirer trop de permissions peut vous bloquer l&apos;accès à votre propre espace.
            </p>
          )}
          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">
              Nom <span className="text-framboise-400">*</span>
            </label>
            <input {...register('name')} placeholder="Artisan" className="form-input" />
            {errors.name && <p className="mt-1 text-erp-xs text-framboise-400">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-erp-sm font-medium text-choco-600 mb-1">Description</label>
            <input {...register('description')} placeholder="Production et stock" className="form-input" />
          </div>

          <div>
            <span className="block text-erp-sm font-medium text-choco-600 mb-2">
              Permissions ({permissions.size})
            </span>
            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label}>
                  <span className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {group.label}
                  </span>
                  <div className="flex flex-col gap-1">
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-start gap-2 text-erp-xs text-choco-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.has(key)}
                          onChange={() => togglePermission(key)}
                          className="mt-0.5 accent-choco-600"
                        />
                        {PERMISSIONS[key]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
            {isEdit ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}
