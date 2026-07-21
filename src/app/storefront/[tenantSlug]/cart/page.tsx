'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { formatPrice } from '@/lib/utils/format';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Image from 'next/image';

export default function CartPage() {
  const params = useParams<{ tenantSlug: string }>();
  const { items, updateQuantity, removeItem, totalTTC } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-neutral-300 mb-4" />
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Panier vide</h1>
        <p className="text-neutral-500 mb-8">Vous n&apos;avez pas encore ajouté de produits.</p>
        <Link
          href={`/storefront/${params.tenantSlug}/catalog`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
        >
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Mon panier</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm"
            >
              {/* Image */}
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                {item.image ? (
                  <Image src={item.image} alt={item.name} width={80} height={80} className="object-cover w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center h-full text-2xl">🥐</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900 dark:text-white text-sm truncate">{item.name}</h3>
                <p className="text-sm text-primary-700 dark:text-primary-400 font-bold mt-1">
                  {formatPrice(item.priceTTC)}
                </p>

                {/* Quantity controls */}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-2 bg-neutral-100 dark:bg-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-600 transition-colors text-neutral-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-neutral-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={item.stockType === 'limited' && item.stockQuantity !== null && item.quantity >= item.stockQuantity}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-600 transition-colors text-neutral-600 disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.productId)}
                    className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Line total */}
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-neutral-900 dark:text-white">
                  {formatPrice(item.priceTTC * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6 sticky top-24">
            <h2 className="font-semibold text-neutral-900 dark:text-white mb-4">Récapitulatif</h2>

            <div className="space-y-2 pb-4 border-b border-neutral-100 dark:border-slate-700">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm text-neutral-600 dark:text-slate-300">
                  <span className="truncate flex-1 mr-2">{item.name} × {item.quantity}</span>
                  <span className="flex-shrink-0">{formatPrice(item.priceTTC * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center py-4 font-bold text-neutral-900 dark:text-white">
              <span>Total TTC</span>
              <span className="text-primary-700 dark:text-primary-400 text-lg">{formatPrice(totalTTC())}</span>
            </div>

            <Link
              href={`/storefront/${params.tenantSlug}/checkout`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
            >
              Commander <ArrowRight size={16} />
            </Link>

            <Link
              href={`/storefront/${params.tenantSlug}/catalog`}
              className="flex items-center justify-center gap-2 w-full py-2.5 mt-3 border border-neutral-200 dark:border-slate-600 text-neutral-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-700 transition-colors"
            >
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
