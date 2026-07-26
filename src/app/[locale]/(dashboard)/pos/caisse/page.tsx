'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Crumb, Btn, Pill } from '@/components/ui';
import { PinPad } from '@/components/pos/PinPad';
import { Minus, Plus, Lock } from 'lucide-react';

interface VerifiedVendeur {
  id: string;
  firstName: string;
  lastName: string;
}
interface Unlocked extends VerifiedVendeur {
  pin: string;
}
interface SessionCaisse {
  id: string;
  vendeurId: string;
  openingFloat: string;
  closingFloat: string | null;
  variance: string | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
}
interface Product {
  id: string;
  name: string;
  category: string | null;
  priceTTC: string;
  directQtyRemaining: number;
}
interface PosSale {
  id: string;
  totalTTC: string;
}
interface PointageHoraire {
  id: string;
  clockIn: string;
  clockOut: string | null;
}

export default function CaissePage() {
  const queryClient = useQueryClient();
  const [unlocked, setUnlocked] = useState<Unlocked | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [openingFloat, setOpeningFloat] = useState('0');
  const [closingFloat, setClosingFloat] = useState('0');
  const [closing, setClosing] = useState(false);
  const [logPadOpen, setLogPadOpen] = useState<'IN' | 'OUT' | null>(null);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['pos-caisse-current', unlocked?.id],
    queryFn: async () => {
      const res = await apiClient.get<SessionCaisse | null>(`/api/v1/pos/caisse?vendeurId=${unlocked!.id}`);
      return res.data;
    },
    enabled: !!unlocked,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const res = await apiClient.get<Product[]>('/api/v1/pos/products');
      return res.data;
    },
    enabled: !!unlocked && !!session,
  });

  const lock = () => {
    setUnlocked(null);
    setCart({});
    setClosing(false);
    setOpeningFloat('0');
    setClosingFloat('0');
  };

  const openMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/api/v1/pos/caisse/open', {
        vendeurId: unlocked!.id,
        pin: unlocked!.pin,
        openingFloat: Number(openingFloat),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-caisse-current', unlocked?.id] });
      toast.success('Caisse ouverte');
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/pos/caisse/${session!.id}/close`, {
        vendeurId: unlocked!.id,
        pin: unlocked!.pin,
        closingFloat: Number(closingFloat),
      }),
    onSuccess: () => {
      toast.success('Caisse fermée');
      lock();
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const finalizeMutation = useMutation({
    mutationFn: (items: { productId: string; quantity: number }[]) =>
      apiClient.post<PosSale>('/api/v1/pos/sales', {
        vendeurId: unlocked!.id,
        pin: unlocked!.pin,
        sessionCaisseId: session!.id,
        paymentMethod,
        items,
      }),
    onSuccess: (res) => {
      toast.success(`Vente finalisée — ${Number(res.data.totalTTC).toFixed(2)}€`);
      lock();
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const clockMutation = useMutation({
    mutationFn: ({ vendeurId, pin, action }: { vendeurId: string; pin: string; action: 'IN' | 'OUT' }) =>
      apiClient.post<PointageHoraire>(`/api/v1/pos/vendeurs/${vendeurId}/clock-${action === 'IN' ? 'in' : 'out'}`, { pin }),
    onSuccess: (_res, variables) => {
      toast.success(variables.action === 'IN' ? 'Arrivée pointée' : 'Départ pointé');
      setLogPadOpen(null);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue');
      setLogPadOpen(null);
    },
  });

  const handleLogService = (action: 'IN' | 'OUT') => {
    if (unlocked) {
      clockMutation.mutate({ vendeurId: unlocked.id, pin: unlocked.pin, action });
    } else {
      setLogPadOpen(action);
    }
  };

  const addToCart = (product: Product) => {
    const current = cart[product.id] ?? 0;
    if (current >= product.directQtyRemaining) return;
    setCart((c) => ({ ...c, [product.id]: current + 1 }));
  };
  const removeFromCart = (productId: string) => {
    setCart((c) => {
      const next = { ...c };
      if ((next[productId] ?? 0) <= 1) delete next[productId];
      else next[productId] -= 1;
      return next;
    });
  };

  const cartLines = useMemo(() => {
    if (!products) return [];
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, qty } : null;
      })
      .filter((l): l is { product: Product; qty: number } => l !== null);
  }, [cart, products]);

  const total = cartLines.reduce((sum, l) => sum + Number(l.product.priceTTC) * l.qty, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Crumb items={['Dashboard', 'Point de vente', 'Caisse']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Caisse</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">Vente, ouverture/fermeture de caisse et pointage.</p>
      </div>

      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] p-6">
        {!unlocked ? (
          <div className="space-y-6">
            <PinPad
              open
              variant="inline"
              onVerified={(v, pin) => setUnlocked({ ...v, pin })}
            />
            <div className="flex gap-2 pt-4 border-t border-[var(--line-1)]">
              <Btn variant="default" className="flex-1 justify-center" onClick={() => handleLogService('IN')}>
                Début de service
              </Btn>
              <Btn variant="default" className="flex-1 justify-center" onClick={() => handleLogService('OUT')}>
                Fin de service
              </Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-erp-sm font-medium text-choco-600">
                Bonjour, <strong>{unlocked.firstName}</strong>
              </p>
              <button
                onClick={lock}
                className="flex items-center gap-1.5 text-erp-xs text-choco-500 hover:text-choco-600"
              >
                <Lock size={12} /> Verrouiller
              </button>
            </div>

            {sessionLoading ? (
              <div className="h-24 bg-neutral-100 rounded animate-skeleton" />
            ) : !session ? (
              <div className="space-y-3">
                <p className="text-erp-sm text-neutral-500">Aucune session de caisse ouverte.</p>
                <div>
                  <label className="block text-erp-sm font-medium text-choco-600 mb-1">Fond d&apos;ouverture déclaré (€)</label>
                  <input
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    type="number"
                    step="0.01"
                    className="form-input"
                  />
                </div>
                <Btn variant="primary" onClick={() => openMutation.mutate()} disabled={openMutation.isPending}>
                  Ouvrir la caisse
                </Btn>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill tone="ok">● Caisse ouverte</Pill>
                  <span className="text-erp-xs text-neutral-500">
                    depuis {new Date(session.openedAt).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })} · fond{' '}
                    {Number(session.openingFloat).toFixed(2)}€
                  </span>
                  {!closing && (
                    <button onClick={() => setClosing(true)} className="ml-auto text-erp-xs text-choco-500 hover:text-choco-600">
                      Fermer la caisse
                    </button>
                  )}
                </div>

                {closing ? (
                  <div className="space-y-3 p-3 rounded-[var(--rx-input)] border border-[var(--line-2)]">
                    <div>
                      <label className="block text-erp-sm font-medium text-choco-600 mb-1">Fond de fermeture déclaré (€)</label>
                      <input
                        value={closingFloat}
                        onChange={(e) => setClosingFloat(e.target.value)}
                        type="number"
                        step="0.01"
                        className="form-input"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Btn variant="default" onClick={() => setClosing(false)}>
                        Annuler
                      </Btn>
                      <Btn variant="primary" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
                        Confirmer la fermeture
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      {productsLoading ? (
                        <div className="grid grid-cols-2 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 bg-neutral-100 rounded animate-skeleton" />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {products?.map((product) => {
                            const inCart = cart[product.id] ?? 0;
                            const isOos = product.directQtyRemaining <= 0;
                            return (
                              <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                disabled={isOos || inCart >= product.directQtyRemaining}
                                className="text-left p-3 rounded-[var(--rx-input)] border border-[var(--line-2)] hover:border-choco-600 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <div className="text-erp-sm font-semibold text-choco-600 line-clamp-1">{product.name}</div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-erp-sm font-medium text-choco-600">
                                    {Number(product.priceTTC).toFixed(2)}€
                                  </span>
                                  {isOos ? (
                                    <Pill tone="crit">rupture</Pill>
                                  ) : (
                                    <span className="text-erp-xs text-neutral-500">{product.directQtyRemaining} dispo</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                          {products?.length === 0 && (
                            <p className="col-span-2 text-erp-sm text-neutral-400 italic text-center py-6">
                              Aucun produit vendable.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-erp-sm font-semibold text-choco-600">Panier</p>
                      {cartLines.length === 0 ? (
                        <p className="text-erp-xs text-neutral-400 italic">Aucun article sélectionné.</p>
                      ) : (
                        <div className="space-y-2">
                          {cartLines.map(({ product, qty }) => (
                            <div key={product.id} className="flex items-center gap-2 text-erp-sm">
                              <span className="flex-1 line-clamp-1">{product.name}</span>
                              <button
                                onClick={() => removeFromCart(product.id)}
                                className="w-6 h-6 flex items-center justify-center rounded border border-[var(--line-2)] hover:bg-[var(--surface-hover)]"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-5 text-center">{qty}</span>
                              <button
                                onClick={() => addToCart(product)}
                                disabled={qty >= product.directQtyRemaining}
                                className="w-6 h-6 flex items-center justify-center rounded border border-[var(--line-2)] hover:bg-[var(--surface-hover)] disabled:opacity-40"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-[var(--line-1)] flex items-center justify-between font-semibold text-choco-600">
                            <span>Total</span>
                            <span>{total.toFixed(2)}€</span>
                          </div>

                          <div className="pt-2 space-y-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPaymentMethod('CASH')}
                                className={`flex-1 h-8 rounded-[var(--rx-input)] text-erp-xs font-medium border ${paymentMethod === 'CASH' ? 'border-choco-600 bg-[var(--surface-hover)] text-choco-600' : 'border-[var(--line-2)] text-neutral-500'}`}
                              >
                                Espèces
                              </button>
                              <button
                                onClick={() => setPaymentMethod('CARD')}
                                className={`flex-1 h-8 rounded-[var(--rx-input)] text-erp-xs font-medium border ${paymentMethod === 'CARD' ? 'border-choco-600 bg-[var(--surface-hover)] text-choco-600' : 'border-[var(--line-2)] text-neutral-500'}`}
                              >
                                Carte
                              </button>
                            </div>
                            <Btn
                              variant="primary"
                              onClick={() => finalizeMutation.mutate(cartLines.map((l) => ({ productId: l.product.id, quantity: l.qty })))}
                              disabled={finalizeMutation.isPending}
                              className="w-full justify-center"
                            >
                              Finaliser la vente
                            </Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <PinPad
        open={logPadOpen !== null}
        onClose={() => setLogPadOpen(null)}
        title={logPadOpen === 'IN' ? 'Début de service — qui pointe ?' : 'Fin de service — qui pointe ?'}
        onVerified={(v, pin) => {
          if (logPadOpen) clockMutation.mutate({ vendeurId: v.id, pin, action: logPadOpen });
        }}
      />
    </div>
  );
}
