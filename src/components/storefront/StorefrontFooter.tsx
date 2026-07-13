interface Props {
  tenant: { name: string; email?: string | null; phone?: string | null; address?: unknown };
}

export function StorefrontFooter({ tenant }: Props) {
  const address = tenant.address as Record<string, string> | null;

  return (
    <footer className="bg-neutral-900 text-neutral-300 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-bold text-white text-lg mb-3">🥐 {tenant.name}</h3>
            {address && (
              <address className="not-italic text-sm text-neutral-400 space-y-1">
                {address.street && <p>{address.street}</p>}
                {(address.postalCode || address.city) && <p>{address.postalCode} {address.city}</p>}
              </address>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Contact</h4>
            <div className="text-sm text-neutral-400 space-y-2">
              {tenant.email && <p>{tenant.email}</p>}
              {tenant.phone && <p>{tenant.phone}</p>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Légal</h4>
            <div className="text-sm text-neutral-400 space-y-2">
              <p>Mentions légales</p>
              <p>Politique de confidentialité</p>
              <p>CGV</p>
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-800 mt-8 pt-6 text-center text-xs text-neutral-600">
          © {new Date().getFullYear()} {tenant.name} · Propulsé par ArtisaStock
        </div>
      </div>
    </footer>
  );
}
