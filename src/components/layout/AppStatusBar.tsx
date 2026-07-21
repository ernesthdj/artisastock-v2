'use client';

function Sep() {
  return <span className="opacity-35">|</span>;
}

export function AppStatusBar({ contexteLabel }: { contexteLabel?: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 h-[25px] flex items-center gap-3.5 px-3.5 bg-[var(--surface-toolbar)] border-t border-[var(--line-2)] text-[11px] text-neutral-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1B7A3E]" /> connecté
      </span>
      {contexteLabel && (
        <>
          <Sep />
          <span>
            Contexte : <strong className="text-choco-600">{contexteLabel}</strong>
          </span>
        </>
      )}
      <Sep />
      <span>v1.0</span>
      <div className="flex-1" />
      <span className="italic">Ctrl+N Nouveau</span>
    </div>
  );
}
