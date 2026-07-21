'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, Factory, MoreHorizontal, Edit, Trash2, Layers } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { BomContextSheet } from '@/components/bom/BomContextSheet';
import { Card, Btn, Pill } from '@/components/ui';

interface BomContext {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { levels: number };
}

export default function BomPage() {
  const { locale } = useParams<{ locale: string }>();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<BomContext | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<BomContext[]>({
    queryKey: ['bom-contexts'],
    queryFn: async () => {
      const res = await apiClient.get<BomContext[]>('/api/v1/bom/contexts?pageSize=50')
      return res.data
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/bom/contexts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-contexts'] });
      toast.success('Contexte supprimé');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Impossible de supprimer : des productions existent pour ce contexte');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    },
  });

  const contexts = data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[var(--rx-card)] bg-[#FFFAE5] border border-or-200">
            <Factory size={20} className="text-or-600" />
          </div>
          <div>
            <h1 className="font-heading text-erp-xl font-bold text-choco-600">
              Nomenclature BOM
            </h1>
            <p className="text-erp-xs text-choco-400">
              Bill of Materials — Contextes de fabrication
            </p>
          </div>
        </div>
        {can('bom.write') && (
          <Btn variant="primary" icon={<Plus size={14} />} onClick={() => { setEditingContext(null); setSheetOpen(true); }}>
            Nouveau contexte
          </Btn>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-amber-50 dark:bg-amber-900/10 animate-pulse" />
          ))}
        </div>
      ) : contexts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Factory size={40} className="text-or-200 mb-4" />
          <h2 className="text-erp-lg font-semibold text-choco-500 mb-1">
            Aucun contexte BOM
          </h2>
          <p className="text-erp-sm text-choco-400 mb-4">
            Créez votre premier contexte de fabrication pour organiser vos fiches BOM.
          </p>
          {can('bom.write') && (
            <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setSheetOpen(true)}>
              Créer un contexte
            </Btn>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contexts.map((ctx) => (
            <Card key={ctx.id} padded={false} className="group relative hover:border-or-300 transition-colors">
              <Link
                href={`/${locale}/bom/${ctx.id}`}
                className="block p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-[var(--rx-card)] bg-[#FFFAE5]">
                    <Layers size={16} className="text-or-600" />
                  </div>
                  <Pill tone={ctx.isActive ? 'ok' : 'neutral'}>{ctx.isActive ? 'Actif' : 'Inactif'}</Pill>
                </div>
                <h3 className="font-semibold text-choco-600 mb-1">{ctx.name}</h3>
                {ctx.description && (
                  <p className="text-erp-xs text-choco-400 line-clamp-2">{ctx.description}</p>
                )}
                <p className="mt-3 text-erp-xs text-choco-300">
                  {ctx._count.levels} niveau{ctx._count.levels > 1 ? 'x' : ''}
                </p>
              </Link>

              {/* Actions menu */}
              {can('bom.write') && (
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === ctx.id ? null : ctx.id); }}
                    className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[#FFFAE5] transition-all"
                  >
                    <MoreHorizontal size={14} className="text-or-600" />
                  </button>
                  {openMenuId === ctx.id && (
                    <div
                      className="absolute right-0 top-8 z-20 min-w-[140px] bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-2)] shadow-[var(--shadow-pop)] py-1"
                      onClick={(e) => e.preventDefault()}
                    >
                      <button
                        onClick={() => { setEditingContext(ctx); setSheetOpen(true); setOpenMenuId(null); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-erp-sm text-choco-500 hover:bg-[var(--surface-hover)]"
                      >
                        <Edit size={12} /> Modifier
                      </button>
                      <button
                        onClick={() => { deleteMutation.mutate(ctx.id); setOpenMenuId(null); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-erp-sm text-framboise-400 hover:bg-[#FFE4E4]"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <BomContextSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingContext(null); }}
        editingId={editingContext?.id}
        initialData={editingContext ? { name: editingContext.name, description: editingContext.description } : undefined}
      />
    </div>
  );
}
