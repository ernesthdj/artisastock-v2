import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion — ArtisaStock',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #3D2817 0%, #2C1810 55%, #1E0F08 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8,
              background: '#D4AF37',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2C1810',
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: 28, fontWeight: 700, fontStyle: 'italic',
              boxShadow: '0 2px 12px rgba(212,175,55,0.4)',
            }}>C</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 24, fontWeight: 700, color: '#F5E6D3', lineHeight: 1.1,
              }}>ArtisaStock</div>
              <div style={{
                fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
                color: 'rgba(212,175,55,.65)', fontWeight: 600,
              }}>ERP pour artisans</div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#FAF7F1',
          borderRadius: 10,
          border: '1px solid #EAD9C8',
          boxShadow: '0 16px 48px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.15)',
          padding: 32,
        }}>
          {children}
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 11, color: 'rgba(245,230,211,.3)',
          letterSpacing: '.03em',
        }}>
          © 2026 ArtisaStock · Tous droits réservés
        </p>
      </div>
    </div>
  );
}
