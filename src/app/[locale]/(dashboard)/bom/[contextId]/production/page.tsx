'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Factory, ChevronRight, Lock, Play, CheckCircle2, XCircle,
  AlertTriangle, Loader2, ArrowLeft, Clock, Package,
} from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { formatQty } from '@/lib/bom/units';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BomLevel {
  id: string;
  order: number;
  name: string;
}

interface BomSheet {
  id: string;
  name: string;
  outputQty: number;
  outputUnit: string;
  prepTime: number | null;
  _count: { lines: number };
}

interface BomContext {
  id: string;
  name: string;
  levels: BomLevel[];
}

interface CostLine {
  lineId: string;
  label: string;
  quantity: number;
  unit: string;
  totalCost: number;
}

interface AvailabilityLine {
  lineId: string;
  label: string;
  required: number;
  unit: string;
  availableInUnit: number;
  sufficient: boolean;
}

interface SimulateResult {
  nBatches: number;
  cost: {
    totalCost: number;
    unitCost: number;
    outputUnit: string;
    lines: CostLine[];
  };
  availability: {
    allSufficient: boolean;
    lines: AvailabilityLine[];
  };
}

interface Production {
  id: string;
  nBatches: number;
  outputQty: number;
  ingredientsCost: number;
  notes: string | null;
  producedAt: string;
  sheet: { name: string; outputUnit: string };
  level: { name: string; order: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatCost(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ─── Page Kanban ─────────────────────────────────────────────────────────────

export default function BomProductionPage() {
  const { locale, contextId } = useParams<{ locale: string; contextId: string }>();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  // State
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [nBatches, setNBatches] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [simResult, setSimResult] = useState<SimulateResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [producing, setProducing] = useState(false);

  // Queries
  const { data: context, isLoading: ctxLoading } = useQuery<BomContext>({
    queryKey: ['bom-context', contextId],
    queryFn: async () => {
      const res = await apiClient.get<BomContext>(`/api/v1/bom/contexts/${contextId}`);
      return res.data;
    },
  });

  const { data: sheets } = useQuery<BomSheet[]>({
    queryKey: ['bom-sheets', selectedLevelId],
    queryFn: async () => {
      const res = await apiClient.get<BomSheet[]>(
        `/api/v1/bom/sheets?levelId=${selectedLevelId}&pageSize=100`
      );
      return res.data;
    },
    enabled: !!selectedLevelId,
  });

  const { data: productionsData } = useQuery<{ data: Production[] }>({
    queryKey: ['bom-productions', contextId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Production[] }>(
        `/api/v1/bom/productions?contextId=${contextId}&pageSize=15`
      );
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const productions: Production[] = (productionsData as unknown as { data: Production[] })?.data ??
    (Array.isArray(productionsData) ? (productionsData as unknown as Production[]) : []);

  const selectedSheet = sheets?.find((s) => s.id === selectedSheetId);
  const totalOutputQty = selectedSheet ? Number(selectedSheet.outputQty) * nBatches : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelectLevel(levelId: string, order: number) {
    if (order === 0) return; // N0 non cliquable
    setSelectedLevelId(levelId);
    setSelectedSheetId(null);
    setSimResult(null);
    setShowConfirm(false);
  }

  function handleSelectSheet(sheetId: string) {
    setSelectedSheetId(sheetId);
    setSimResult(null);
    setShowConfirm(false);
  }

  async function handleSimulate() {
    if (!selectedSheetId) return;
    setSimLoading(true);
    setSimResult(null);
    setShowConfirm(false);
    try {
      const res = await apiClient.get<SimulateResult>(
        `/api/v1/bom/sheets/${selectedSheetId}/simulate?nBatches=${nBatches}`
      );
      setSimResult(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur simulation');
    } finally {
      setSimLoading(false);
    }
  }

  async function handleProduce() {
    if (!selectedSheetId || !simResult?.availability.allSufficient) return;
    setProducing(true);
    try {
      await apiClient.post(`/api/v1/bom/sheets/${selectedSheetId}/produce`, {
        nBatches,
        notes: notes || undefined,
      });
      toast.success('Production lancée avec succès !');
      setShowConfirm(false);
      // Invalider les queries
      queryClient.invalidateQueries({ queryKey: ['bom-productions', contextId] });
      // Re-simuler pour afficher les stocks mis à jour
      const res = await apiClient.get<SimulateResult>(
        `/api/v1/bom/sheets/${selectedSheetId}/simulate?nBatches=${nBatches}`
      );
      setSimResult(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur production');
    } finally {
      setProducing(false);
    }
  }

  // ── Grouper l'historique par jour ─────────────────────────────────────────

  const groupedProductions: Array<{ day: string; items: Production[] }> = [];
  for (const p of productions) {
    const day = formatDate(p.producedAt);
    const existing = groupedProductions.find((g) => g.day === day);
    if (existing) {
      existing.items.push(p);
    } else {
      groupedProductions.push({ day, items: [p] });
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (ctxLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-96 bg-amber-100 dark:bg-amber-900/20 rounded animate-pulse mb-4" />
        <div className="flex gap-4 h-[calc(100vh-160px)]">
          {[52, 'flex-1', 64].map((w, i) => (
            <div
              key={i}
              className="bg-amber-50 dark:bg-amber-900/10 rounded-xl animate-pulse"
              style={{ width: typeof w === 'number' ? `${w * 4}px` : undefined, flex: typeof w === 'string' ? 1 : undefined }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!context) {
    return <div className="p-6 text-amber-600 dark:text-amber-400">Contexte introuvable.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-amber-500 px-6 py-4 border-b border-amber-100 dark:border-amber-900/30 shrink-0">
        <Link
          href={`/${locale}/bom`}
          className="hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1"
        >
          <Factory size={14} /> Nomenclature BOM
        </Link>
        <ChevronRight size={14} />
        <Link
          href={`/${locale}/bom/${contextId}`}
          className="hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1"
        >
          <ArrowLeft size={12} /> {context.name}
        </Link>
        <ChevronRight size={14} />
        <span className="text-amber-900 dark:text-amber-100 font-semibold flex items-center gap-1">
          <Play size={12} /> Production
        </span>
      </div>

      {/* ── Kanban 3 colonnes ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Col 1 : Niveaux & Fiches (w-52) ──────────────────────────────── */}
        <aside className="w-52 shrink-0 border-r border-amber-100 dark:border-amber-900/30 flex flex-col overflow-hidden">
          <div className="px-3 py-3 border-b border-amber-100 dark:border-amber-900/30">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              Niveaux & Fiches
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
            {context.levels.map((level) => (
              <div key={level.id}>
                {/* Niveau */}
                <button
                  onClick={() => handleSelectLevel(level.id, level.order)}
                  disabled={level.order === 0}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-xs font-semibold ${
                    level.order === 0
                      ? 'text-amber-400 dark:text-amber-700 cursor-not-allowed'
                      : selectedLevelId === level.id
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  }`}
                >
                  <span className="font-bold">N{level.order}</span>
                  <span className="truncate">{level.name}</span>
                  {level.order === 0 && <Lock size={9} className="shrink-0" />}
                </button>

                {/* Fiches du niveau sélectionné */}
                {selectedLevelId === level.id && sheets && (
                  <div className="ml-3 mt-1 space-y-0.5">
                    {sheets.map((sheet) => (
                      <button
                        key={sheet.id}
                        onClick={() => handleSelectSheet(sheet.id)}
                        className={`w-full flex items-start gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors text-xs ${
                          selectedSheetId === sheet.id
                            ? 'bg-amber-200 dark:bg-amber-800/60 border border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100'
                            : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        }`}
                      >
                        <Package size={10} className="mt-0.5 shrink-0" />
                        <span className="truncate leading-tight">{sheet.name}</span>
                      </button>
                    ))}
                    {sheets.length === 0 && (
                      <p className="px-2 py-1 text-xs text-amber-400 dark:text-amber-700 italic">
                        Aucune fiche
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Col 2 : Panneau Simulation ─────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden border-r border-amber-100 dark:border-amber-900/30">
          {!selectedSheetId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Play size={32} className="text-amber-300 dark:text-amber-700 mb-3" />
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
                Sélectionnez une fiche BOM
              </p>
              <p className="text-xs text-amber-400 dark:text-amber-600">
                Choisissez un niveau N1+ puis une fiche pour simuler la production.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Header fiche */}
              {selectedSheet && (
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-amber-100 dark:border-amber-900/30">
                  <div>
                    <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                      {selectedSheet.name}
                    </h2>
                    <p className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">
                      1 batch = {formatQty(Number(selectedSheet.outputQty), selectedSheet.outputUnit as Parameters<typeof formatQty>[1])}
                      {selectedSheet.prepTime && (
                        <span className="ml-3 inline-flex items-center gap-1">
                          <Clock size={10} /> {selectedSheet.prepTime} min
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Inputs simulation */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-amber-700 dark:text-amber-400 w-24 shrink-0">
                    Nb batches
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={nBatches}
                    onChange={(e) => {
                      setNBatches(parseFloat(e.target.value) || 1);
                      setSimResult(null);
                    }}
                    className="w-24 px-2 py-1.5 text-sm border border-amber-200 dark:border-amber-800 rounded-md bg-white dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {selectedSheet && (
                    <span className="text-xs text-amber-500 dark:text-amber-500">
                      → Total :{' '}
                      <strong>{formatQty(totalOutputQty, selectedSheet.outputUnit as Parameters<typeof formatQty>[1])}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <label className="text-xs font-medium text-amber-700 dark:text-amber-400 w-24 shrink-0 pt-1.5">
                    Notes (opt.)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaire optionnel…"
                    className="flex-1 px-2 py-1.5 text-sm border border-amber-200 dark:border-amber-800 rounded-md bg-white dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 placeholder:text-amber-300 dark:placeholder:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={simLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 dark:disabled:bg-amber-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {simLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Simuler
                </button>
              </div>

              {/* Résultat simulation */}
              {simResult && (
                <div className="space-y-4">
                  {/* Table disponibilité */}
                  <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40">
                          <th className="text-left px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Ingrédient</th>
                          <th className="text-right px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Requis</th>
                          <th className="text-right px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Disponible</th>
                          <th className="text-center px-3 py-2 font-semibold text-amber-700 dark:text-amber-400">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.availability.lines.map((line, i) => (
                          <tr
                            key={line.lineId}
                            className={`border-b last:border-0 ${
                              line.sufficient
                                ? 'bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900/30'
                                : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30'
                            } ${i % 2 === 0 ? '' : 'bg-opacity-70'}`}
                          >
                            <td className="px-3 py-2 font-medium text-amber-900 dark:text-amber-100">
                              {line.label}
                            </td>
                            <td className="px-3 py-2 text-right text-amber-700 dark:text-amber-400">
                              {formatQty(line.required, line.unit as Parameters<typeof formatQty>[1])}
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${
                              line.sufficient
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {formatQty(line.availableInUnit, line.unit as Parameters<typeof formatQty>[1])}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {line.sufficient ? (
                                <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                              ) : (
                                <XCircle size={14} className="text-red-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Résumé global + coût */}
                  <div className={`rounded-xl px-4 py-3 flex items-center justify-between gap-4 ${
                    simResult.availability.allSufficient
                      ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40'
                      : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40'
                  }`}>
                    <div className="flex items-center gap-2">
                      {simResult.availability.allSufficient ? (
                        <>
                          <CheckCircle2 size={16} className="text-green-500" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-400">
                            Tous les stocks sont suffisants
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} className="text-red-500" />
                          <span className="text-sm font-medium text-red-600 dark:text-red-400">
                            {simResult.availability.lines.filter((l) => !l.sufficient).length} pénurie(s) — production bloquée
                          </span>
                        </>
                      )}
                    </div>
                    {simResult.availability.allSufficient && (
                      <div className="text-right text-xs text-amber-700 dark:text-amber-400 shrink-0">
                        <div>Coût total : <strong className="text-amber-900 dark:text-amber-100">{formatCost(simResult.cost.totalCost)}</strong></div>
                        <div>Coût unitaire : <strong>{formatCost(simResult.cost.unitCost)}</strong>/{simResult.cost.outputUnit.toLowerCase()}</div>
                      </div>
                    )}
                  </div>

                  {/* Bouton Lancer + Confirmation */}
                  {can('bom.produce') && (
                    <div className="space-y-2">
                      {!showConfirm ? (
                        <div>
                          <button
                            onClick={() => setShowConfirm(true)}
                            disabled={!simResult.availability.allSufficient}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-200 dark:disabled:bg-amber-900/40 disabled:text-amber-400 dark:disabled:text-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
                          >
                            <Play size={14} /> Lancer la production
                          </button>
                          {!simResult.availability.allSufficient && (
                            <p className="mt-1.5 text-xs text-amber-500 dark:text-amber-600 italic">
                              Simulez d&apos;abord — aucune pénurie requise pour lancer la production.
                            </p>
                          )}
                        </div>
                      ) : (
                        /* Confirmation inline */
                        <div className="rounded-xl border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                            Confirmer la production ?
                          </p>
                          <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                            <div>Fiche : <strong>{selectedSheet?.name}</strong></div>
                            <div>Nb batches : <strong>{nBatches}</strong></div>
                            <div>Qty totale : <strong>
                              {selectedSheet && formatQty(totalOutputQty, selectedSheet.outputUnit as Parameters<typeof formatQty>[1])}
                            </strong></div>
                            <div>Coût estimé : <strong>{formatCost(simResult.cost.totalCost)}</strong></div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => setShowConfirm(false)}
                              disabled={producing}
                              className="px-4 py-1.5 text-xs font-medium border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={handleProduce}
                              disabled={producing}
                              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white rounded-lg transition-colors"
                            >
                              {producing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                              Confirmer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Col 3 : Historique (w-64) ─────────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 dark:border-amber-900/30">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              Historique
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {groupedProductions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <Clock size={20} className="text-amber-300 dark:text-amber-700 mb-2" />
                <p className="text-xs text-amber-400 dark:text-amber-600">
                  Aucune production pour ce contexte.
                </p>
              </div>
            ) : (
              groupedProductions.map((group) => (
                <div key={group.day} className="mb-3">
                  <p className="px-4 py-1 text-[10px] font-semibold text-amber-500 dark:text-amber-600 uppercase tracking-wide">
                    {group.day}
                  </p>
                  {group.items.map((p, i) => (
                    <div
                      key={p.id}
                      className={`mx-2 mb-1 px-3 py-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30 ${
                        i % 2 === 0
                          ? 'bg-white dark:bg-amber-950/10'
                          : 'bg-amber-50/60 dark:bg-amber-900/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 truncate leading-tight">
                          {p.sheet.name}
                        </p>
                        <span className="text-[10px] text-amber-400 dark:text-amber-600 shrink-0">
                          {formatTime(p.producedAt)}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-500 dark:text-amber-500">
                        N{p.level.order} · {p.nBatches} batch{Number(p.nBatches) > 1 ? 'es' : ''} · {formatQty(Number(p.outputQty), p.sheet.outputUnit as Parameters<typeof formatQty>[1])}
                      </p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                        Coût : {formatCost(Number(p.ingredientsCost))}
                      </p>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
