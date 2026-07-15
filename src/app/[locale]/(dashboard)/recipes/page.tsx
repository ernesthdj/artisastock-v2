export default function RecettesPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 40 }}>
      {/* Icon badge */}
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: 'rgba(199,122,40,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, marginBottom: 20,
        border: '1px solid rgba(199,122,40,0.18)',
      }}>
        👨‍🍳
      </div>

      <h1 style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 26, fontWeight: 700, color: '#3D2817',
        margin: '0 0 8px 0', letterSpacing: '-0.01em',
      }}>
        Recettes
      </h1>
      <p style={{ fontSize: 14, color: '#807865', margin: '0 0 32px 0', lineHeight: 1.6 }}>
        Gérez vos fiches recettes, coûts de production et nomenclatures.
      </p>

      {/* Placeholder card */}
      <div style={{
        background: '#FFFFFF',
        border: '1px dashed #D4C4B4',
        borderRadius: 8,
        padding: '48px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#F5EFE6', border: '1px solid #EAD9C8',
          borderRadius: 20, padding: '6px 14px',
          fontSize: 12, fontWeight: 600, color: '#9E7B5C',
          letterSpacing: '.04em', textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          🚧 En développement
        </div>
        <p style={{ fontSize: 13.5, color: '#ACA899', margin: 0, lineHeight: 1.6 }}>
          Cette section sera disponible prochainement.<br />
          Le module <strong style={{ color: '#6F4E37' }}>Recettes</strong> est en cours de construction.
        </p>
      </div>
    </div>
  );
}
