'use client';

import { X, Warehouse } from 'lucide-react';

export interface StockDetailRow {
  id: string;
  date: string;
  qty: number;
  unitCost: number;
  expiry?: string | null;
  stockName?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  unit: string;
  dateLabel: string;
  rows: StockDetailRow[];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-BE');

export function StockDetailPanel({ open, onClose, title, subtitle, unit, dateLabel, rows }: Props) {
  if (!open) return null;

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalValue = rows.reduce((s, r) => s + r.qty * r.unitCost, 0);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-neutral-0 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line-1)]">
          <div>
            <h2 className="text-erp-lg font-semibold text-choco-600">{title}</h2>
            {subtitle && <p className="text-erp-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-choco-600 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          <p className="text-erp-xs font-semibold text-neutral-500 uppercase tracking-wide">
            {rows.length} lot{rows.length > 1 ? 's' : ''} disponible{rows.length > 1 ? 's' : ''}
          </p>

          {rows.length === 0 ? (
            <p className="text-erp-xs text-neutral-400 italic">Aucun lot disponible.</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-erp-xs px-3 py-2 rounded border border-[var(--line-1)]">
                  <div>
                    <div className="font-medium text-choco-600">
                      {dateLabel} : {fmtDate(r.date)}
                    </div>
                    {r.stockName !== undefined && (
                      <div className="text-neutral-500 mt-0.5 inline-flex items-center gap-1">
                        <Warehouse size={11} />
                        {r.stockName ?? <span className="italic">non renseigné</span>}
                      </div>
                    )}
                    {r.expiry && <div className="text-neutral-500 mt-0.5">DLC : {fmtDate(r.expiry)}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-choco-600">
                      {r.qty} {unit.toLowerCase()}
                    </div>
                    <div className="text-neutral-500 mt-0.5">{r.unitCost.toFixed(4)}€/{unit.toLowerCase()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--line-1)] flex items-center justify-between">
          <span className="text-erp-sm font-medium text-choco-600">
            Total : {totalQty} {unit.toLowerCase()}
          </span>
          <span className="text-erp-sm font-semibold text-choco-600">{totalValue.toFixed(2)}€</span>
        </div>
      </div>
    </>
  );
}
