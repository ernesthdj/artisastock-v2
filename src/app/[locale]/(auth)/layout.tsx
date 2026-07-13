import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl">🥐</span>
            <span className="text-2xl font-bold text-primary-700">ArtisaStock</span>
          </div>
          <p className="text-sm text-neutral-500">ERP & vitrine pour artisans alimentaires</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-neutral-200 dark:border-slate-700 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
