'use client';

import Link from 'next/link';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCartStore } from '@/store/cart';

interface Props {
  tenant: { name: string; phone?: string | null };
  pages: Array<{ slug: string; title: string }>;
  tenantSlug: string;
}

export function StorefrontHeader({ tenant, pages, tenantSlug }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const base = `/storefront/${tenantSlug}`;

  return (
    <header className={`sticky top-0 z-30 transition-shadow ${scrolled ? 'shadow-md bg-white/95 backdrop-blur' : 'bg-white'} dark:bg-slate-900 border-b border-neutral-100 dark:border-slate-800`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href={base} className="font-bold text-xl text-primary-700 dark:text-primary-400 flex items-center gap-2">
          🥐 {tenant.name}
        </Link>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href={base} className="text-sm text-neutral-600 hover:text-primary-700 dark:text-slate-300 font-medium transition-colors">
            Accueil
          </Link>
          <Link href={`${base}/catalog`} className="text-sm text-neutral-600 hover:text-primary-700 dark:text-slate-300 font-medium transition-colors">
            Catalogue
          </Link>
          {pages.slice(0, 3).map((page) => (
            <Link
              key={page.slug}
              href={`${base}/page/${page.slug}`}
              className="text-sm text-neutral-600 hover:text-primary-700 dark:text-slate-300 font-medium transition-colors"
            >
              {page.title}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <Link
            href={`${base}/cart`}
            className="relative p-2 text-neutral-600 hover:text-primary-700 transition-colors"
          >
            <ShoppingCart size={22} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-neutral-600">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-neutral-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-3">
          <Link href={base} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-neutral-700 dark:text-slate-200 py-2">Accueil</Link>
          <Link href={`${base}/catalog`} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-neutral-700 dark:text-slate-200 py-2">Catalogue</Link>
          {pages.map((p) => (
            <Link key={p.slug} href={`${base}/page/${p.slug}`} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-neutral-700 dark:text-slate-200 py-2">
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
