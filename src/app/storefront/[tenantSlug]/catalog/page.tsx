'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '@/store/cart';
import { toast } from 'sonner';
import { Search, ShoppingCart, Plus } from 'lucide-react';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils/format';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  images: string[];
  priceTTC: number;
  vatRate: string;
  allergens: string[];
  stockType: string;
  stockQuantity: number | null;
}

export default function CatalogPage({ params }: { params: { tenantSlug: string } }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const addItem = useCartStore((s) => s.addItem);
  const setTenantSlug = useCartStore((s) => s.setTenantSlug);

  const { data, isLoading } = useQuery({
    queryKey: ['storefront-products', params.tenantSlug, search, category],
    queryFn: async () => {
      const sp = new URLSearchParams({ pageSize: '50' });
      if (search) sp.set('search', search);
      if (category) sp.set('category', category);
      const res = await fetch(`/api/storefront/${params.tenantSlug}/products?${sp}`);
      const json = await res.json();
      return json.data as { data: Product[]; total: number };
    },
  });

  const products = (data as Record<string, unknown>)?.['data'] as Product[] ?? [];

  const categories = [...new Set(products.map((p) => p.category))].sort();

  const handleAddToCart = (product: Product) => {
    const isOos = product.stockType === 'limited' && product.stockQuantity !== null && product.stockQuantity <= 0;
    if (isOos) { toast.error('Ce produit est en rupture de stock'); return; }

    setTenantSlug(params.tenantSlug);
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      priceTTC: Number(product.priceTTC),
      image: product.images[0],
      stockType: product.stockType,
      stockQuantity: product.stockQuantity,
    });
    toast.success(`${product.name} ajouté au panier`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Notre catalogue</h1>
      <p className="text-neutral-500 mb-8">Commandez en ligne, retirez en boutique</p>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategory('')}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${!category ? 'bg-primary-600 text-white border-primary-600' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c === category ? '' : c)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${category === c ? 'bg-primary-600 text-white border-primary-600' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-neutral-200">
              <div className="aspect-[4/3] bg-neutral-100 animate-skeleton" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-neutral-100 rounded animate-skeleton w-3/4" />
                <div className="h-4 bg-neutral-100 rounded animate-skeleton w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-2xl mb-2">🥐</p>
          <p className="text-neutral-500">Aucun produit disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {products.map((product) => {
            const isOos = product.stockType === 'limited' && product.stockQuantity !== null && product.stockQuantity <= 0;

            return (
              <div key={product.id} className="product-card group">
                {/* Image */}
                <div className="aspect-[4/3] relative overflow-hidden bg-neutral-100">
                  {product.images[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-5xl">🥐</div>
                  )}
                  {isOos && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="bg-white/90 text-neutral-700 text-sm font-medium px-3 py-1 rounded-full">
                        Indisponible
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-xs text-neutral-400 mb-1 uppercase tracking-wide">{product.category}</p>
                  <h3 className="font-semibold text-neutral-900 dark:text-white text-sm leading-snug mb-1 line-clamp-1">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary-700 dark:text-primary-400">
                      {formatPrice(Number(product.priceTTC))}
                    </span>
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={isOos}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
