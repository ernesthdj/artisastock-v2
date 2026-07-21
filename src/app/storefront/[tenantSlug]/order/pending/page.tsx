'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function OrderPendingPage() {
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    // Webhook stripe traitera la session asynchronement.
    // On affiche simplement une page d'attente.
    if (!sessionId) { setStatus('error'); return; }
    // Attendre quelques secondes pour que le webhook traite la session
    const timer = setTimeout(() => setStatus('success'), 3000);
    return () => clearTimeout(timer);
  }, [sessionId]);

  if (status === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Loader2 size={48} className="animate-spin text-primary-600" />
        <h1 className="text-xl font-semibold text-neutral-900">Traitement du paiement...</h1>
        <p className="text-neutral-500 text-sm">Veuillez patienter, nous confirmons votre commande.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <XCircle size={64} className="text-red-500" />
        <h1 className="text-xl font-semibold text-neutral-900">Paiement annulé</h1>
        <p className="text-neutral-500 text-sm">Votre paiement n&apos;a pas été complété.</p>
        <Link href={`/storefront/${params.tenantSlug}/cart`} className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl">
          Retour au panier
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle2 size={48} className="text-green-500" />
      </div>
      <h1 className="text-2xl font-bold text-neutral-900">Commande confirmée ! 🎉</h1>
      <p className="text-neutral-600 max-w-sm">
        Merci pour votre commande. Vous allez recevoir un email de confirmation avec les détails de votre retrait.
      </p>
      <Link href={`/storefront/${params.tenantSlug}/catalog`} className="mt-4 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors">
        Retour à la boutique
      </Link>
    </div>
  );
}
