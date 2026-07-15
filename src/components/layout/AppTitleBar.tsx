'use client';

import { useAuth } from '@/providers/AuthProvider';
import { Search } from 'lucide-react';

export function AppTitleBar() {
  const { user } = useAuth();

  return (
    <div
      style={{
        height: 38,
        background: 'linear-gradient(to bottom, #3D2817 0%, #2C1810 100%)',
        borderBottom: '1px solid #1E0F08',
        color: '#F5E6D3',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 12.5,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        flexShrink: 0,
      }}
    >
      {/* Logo + brand */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        paddingRight: 12, borderRight: '1px solid rgba(212,175,55,.2)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 3,
          background: '#D4AF37',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#2C1810',
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 14, fontWeight: 700, fontStyle: 'italic',
        }}>C</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '.02em' }}>ArtisaStock</span>
          <span style={{ fontSize: 9.5, color: 'rgba(212,175,55,.7)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {user?.firstName ? `${user.firstName} ${user.lastName}` : 'Mon espace'}
          </span>
        </div>
      </div>

      {/* Search bar */}
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,.07)',
        border: '1px solid rgba(212,175,55,.25)',
        color: 'rgba(245,230,211,.85)',
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 4,
        cursor: 'pointer',
        width: 220,
        fontFamily: 'inherit',
      }}>
        <Search size={12} style={{ opacity: 0.7 }} />
        <span style={{ flex: 1, textAlign: 'left', color: 'rgba(245,230,211,.45)' }}>
          Rechercher…
        </span>
        <span style={{
          fontFamily: 'SFMono-Regular, Menlo, monospace',
          fontSize: 10, padding: '1px 5px',
          borderRadius: 3, background: 'rgba(0,0,0,.15)', color: 'rgba(245,230,211,.5)',
        }}>⌘K</span>
      </button>

      <div style={{ flex: 1 }} />

      {/* User pill */}
      {user && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px',
          borderRadius: 4,
          background: 'rgba(212,175,55,.1)',
          border: '1px solid rgba(212,175,55,.2)',
          fontSize: 12, color: 'rgba(245,230,211,.85)',
          cursor: 'default',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: '#3D2817', color: '#D4AF37',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700,
            border: '1px solid rgba(212,175,55,.4)',
          }}>
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <span>{user.firstName}</span>
        </div>
      )}
    </div>
  );
}
