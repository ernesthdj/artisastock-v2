'use client';

import { useAuth } from '@/providers/AuthProvider';
import { Search, Power } from 'lucide-react';

export function AppTitleBar() {
  const { user, logout } = useAuth();

  return (
    <div className="fixed top-0 left-0 right-0 z-30 h-10 flex items-center gap-3 px-3.5 bg-gradient-to-b from-choco-600 to-choco-700 border-b border-choco-800 text-[#F5E6D3] text-erp-sm">
      {/* Logo + brand */}
      <div className="flex items-center gap-2 pr-3.5 border-r border-or-400/20 flex-shrink-0">
        <div className="w-6 h-6 rounded-[5px] bg-or-400 inline-flex items-center justify-center text-choco-800 font-heading font-bold italic text-[15px]">
          C
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-erp-sm font-bold tracking-wide">ArtisaStock</span>
          <span className="text-[9px] text-or-400/70 tracking-widest">CHARLES &amp; NADEJDA</span>
        </div>
      </div>

      {/* Search bar (non fonctionnelle — placeholder) */}
      <button className="hidden sm:inline-flex items-center gap-2 bg-white/[.07] border border-or-400/25 text-[#F5E6D3]/85 text-erp-xs px-2.5 py-1 rounded-[var(--rx-md)] w-[220px] font-inherit">
        <Search size={12} className="opacity-70" />
        <span className="flex-1 text-left text-[#F5E6D3]/45">Rechercher…</span>
        <span className="font-mono text-[10px] px-1.5 py-px rounded-sm bg-black/[.15] text-[#F5E6D3]/50">⌘K</span>
      </button>

      <div className="flex-1" />

      {/* Connection indicator */}
      <span className="hidden md:inline-flex items-center gap-1.5 text-[#F5E6D3]/75">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5CB85C]" /> Connecté
      </span>
      <span className="hidden md:inline opacity-30">|</span>

      {/* User pill */}
      {user && (
        <div className="flex items-center gap-1.5 px-2 py-[3px] rounded-[var(--rx-md)] bg-or-400/10 border border-or-400/20 text-erp-xs text-[#F5E6D3]/85">
          <div className="w-[18px] h-[18px] rounded-full bg-choco-600 text-or-400 inline-flex items-center justify-center text-[9px] font-bold border border-or-400/40">
            {user.firstName[0]}
            {user.lastName[0]}
          </div>
          <span>{user.firstName}</span>
        </div>
      )}

      <button
        onClick={logout}
        className="inline-flex items-center gap-1.5 bg-white/[.08] border border-or-400/25 text-[#F5E6D3] text-erp-xs px-2.5 py-1 rounded-[var(--rx-md)] font-medium"
      >
        <Power size={12} /> Déconnecter
      </button>
    </div>
  );
}
