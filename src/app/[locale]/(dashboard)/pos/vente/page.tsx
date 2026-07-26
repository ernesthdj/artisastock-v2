'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Crumb, Btn, Pill } from '@/components/ui';
import { VendeurPicker } from '@/components/pos/VendeurPicker';
import { Minus, Plus } from 'lucide-react';

interface SessionCaisse {
  id: string;
  status: 'OPEN' | 'CLOSED';
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

export default function VentePage() {
  const queryClient = useQueryClient();
  const [vendeurId, setVendeurId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [pin, setPin] = useState('');

  const { data: session } = useQuery({
    queryKey: ['pos-caisse-current', vendeurId],
    queryFn: async () => {
      const res = await apiClient.get<SessionCaisse | null>(`/api/v1/pos/caisse?vendeurId=${vendeurId}`);
      return res.data;
    },
    enabled: !!vendeurId,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const res = await apiClient.get<Product[]>('/api/v1/pos/products');
      return res.data;
    },
    enabled: !!session,
  });

  const finalizeMutation = useMutation({
    mutationFn: (items: { productId: string; quantity: number }[]) =>
      apiClient.post<PosSale>('/api/v1/pos/sales', {
        vendeurId,
        pin,
        sessionCaisseId: session?.id,
        paymentMethod,
        items,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      toast.success(`Vente finalisée — ${Number(res.data.totalTTC).toFixed(2)}€`);
      setCart({});
      setPin('');
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const changeVendeur = () => {
    setVendeurId(null);
    setCart({});
    setPin('');
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
        if (!product) return null;
        return { product, qty };
      })
      .filter((l): l is { product: Product; qty: number } => l !== null);
  }, [cart, products]);

  const total = cartLines.reduce((sum, l) => sum + Number(l.product.priceTTC) * l.qty, 0);

  const handleFinalize = () => {
    finalizeMutation.mutate(cartLines.map((l) => ({ productId: l.product.id, quantity: l.qty })));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Crumb items={['Dashboard', 'Point de vente', 'Vente']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Vente</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">Composer une vente comptoir.</p>
      </div>

      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] p-6">
        {!vendeurId ? (
          <>
            <p className="text-erp-sm font-medium text-choco-600 mb-3">Qui êtes-vous ?</p>
            <VendeurPicker selectedId={vendeurId} onSelect={setVendeurId} />
          </>
        ) : (
          <div className="space-y-5">
            <button onClick={changeVendeur} className="text-erp-xs text-choco-500 hover:text-choco-600">
              ← Changer de vendeur
            </button>

            {!session ? (
              <div className="space-y-2">
                <Pill tone="warn">Aucune session de caisse ouverte</Pill>
                <p className="text-erp-xs text-neutral-500">
                  Ouvrez une session depuis l&apos;écran Caisse avant de composer une vente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-3">
                  {isLoading ? (
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
                            className="text-left p-3 rounded-[var(--rx-input)] border border-[var(--line-2)] hover:border-choco-600 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--line-2)]"
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
                        <input
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="PIN"
                          className="form-input"
                        />
                        <Btn
                          variant="primary"
                          onClick={handleFinalize}
                          disabled={finalizeMutation.isPending || pin.length !== 4}
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
    </div>
  );
}
