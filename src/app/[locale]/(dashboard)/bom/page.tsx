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
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Factory size={20} className="text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-amber-900 dark:text-amber-100">
              Nomenclature BOM
            </h1>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Bill of Materials — Contextes de fabrication
            </p>
          </div>
        </div>
        {can('bom.write') && (
          <button
            onClick={() => { setEditingContext(null); setSheetOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} /> Nouveau contexte
          </button>
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
          <Factory size={40} className="text-amber-300 dark:text-amber-700 mb-4" />
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-1">
            Aucun contexte BOM
          </h2>
          <p className="text-sm text-amber-500 dark:text-amber-500 mb-4">
            Créez votre premier contexte de fabrication pour organiser vos fiches BOM.
          </p>
          {can('bom.write') && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} /> Créer un contexte
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contexts.map((ctx) => (
            <div
              key={ctx.id}
              className="group relative rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
            >
              <Link
                href={`/${locale}/bom/${ctx.id}`}
                className="block p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                    <Layers size={16} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    ctx.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {ctx.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">{ctx.name}</h3>
                {ctx.description && (
                  <p className="text-xs text-amber-500 dark:text-amber-500 line-clamp-2">{ctx.description}</p>
                )}
                <p className="mt-3 text-xs text-amber-400 dark:text-amber-600">
                  {ctx._count.levels} niveau{ctx._count.levels > 1 ? 'x' : ''}
                </p>
              </Link>

              {/* Actions menu */}
              {can('bom.write') && (
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => { e.preventDefault(); setOpenMenuId(openMenuId === ctx.id ? null : ctx.id); }}
                    className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                  >
                    <MoreHorizontal size={14} className="text-amber-600 dark:text-amber-400" />
                  </button>
                  {openMenuId === ctx.id && (
                    <div
                      className="absolute right-0 top-8 z-20 min-w-[140px] bg-white dark:bg-[#1a0f0a] rounded-lg border border-amber-200 dark:border-amber-800 shadow-lg py-1"
                      onClick={(e) => e.preventDefault()}
                    >
                      <button
                        onClick={() => { setEditingContext(ctx); setSheetOpen(true); setOpenMenuId(null); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                      >
                        <Edit size={12} /> Modifier
                      </button>
                      <button
                        onClick={() => { deleteMutation.mutate(ctx.id); setOpenMenuId(null); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
