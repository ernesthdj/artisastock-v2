'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Pill, Btn } from '@/components/ui';
import { Boxes, Factory, Wallet, ShoppingBag, RotateCcw } from 'lucide-react';

interface FlowStock {
  id: string;
  name: string;
  alerte: boolean;
}
interface FlowSummary {
  activite: { id: string; name: string; ficheCount: number; alertesCount: number };
  stocks: FlowStock[];
  pos: { productCount: number; qtyTotal: number };
  boutique: { productCount: number; qtyTotal: number };
}

type NodeId = 'stocks' | 'activite' | 'pos' | 'boutique';
type Position = { x: number; y: number };

const NODE_SIZE = { w: 190, h: 72 };

function defaultLayout(): Record<NodeId, Position> {
  return {
    stocks: { x: 16, y: 90 },
    activite: { x: 250, y: 90 },
    pos: { x: 484, y: 16 },
    boutique: { x: 484, y: 164 },
  };
}

type Selected = { kind: NodeId } | null;

export function FlowCanvas({ activiteId }: { activiteId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState<Record<NodeId, Position>>(defaultLayout());
  const [selected, setSelected] = useState<Selected>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['flow-summary', activiteId],
    queryFn: async () => {
      const res = await apiClient.get<FlowSummary>(`/api/v1/activites/${activiteId}/flow-summary`);
      return res.data;
    },
    enabled: !!activiteId,
  });

  const renameActiviteMutation = useMutation({
    mutationFn: (name: string) => apiClient.patch(`/api/v1/activites/${activiteId}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activites'] });
      queryClient.invalidateQueries({ queryKey: ['flow-summary', activiteId] });
      toast.success('Activité renommée');
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const renameStockMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiClient.patch(`/api/v1/stocks/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-summary', activiteId] });
      toast.success('Stock renommé');
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const moveNode = (id: NodeId, pos: Position) => setLayout((l) => ({ ...l, [id]: pos }));
  const center = (id: NodeId) => ({ x: layout[id].x + NODE_SIZE.w / 2, y: layout[id].y + NODE_SIZE.h / 2 });
  const link = (a: NodeId, b: NodeId) => {
    const from = center(a);
    const to = center(b);
    const mx = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`;
  };

  if (isLoading || !data) {
    return (
      <div className="h-[380px] rounded-[var(--rx-card)] border border-[var(--line-1)] bg-neutral-0 animate-skeleton" />
    );
  }

  return (
    <div className="relative h-[380px] rounded-[var(--rx-card)] border border-[var(--line-1)] bg-[#FBF9F4] overflow-hidden">
      <button
        onClick={() => setLayout(defaultLayout())}
        title="Réorganiser"
        className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded border border-[var(--line-2)] bg-neutral-0 text-neutral-500 hover:text-choco-600 hover:border-choco-600"
      >
        <RotateCcw size={13} />
      </button>

      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <path d={link('stocks', 'activite')} fill="none" stroke="#6F4E37" strokeWidth="2" opacity="0.35" />
        <path d={link('activite', 'pos')} fill="none" stroke="#D4AF37" strokeWidth="2" opacity="0.35" />
        <path d={link('activite', 'boutique')} fill="none" stroke="#D4AF37" strokeWidth="2" opacity="0.35" />
      </svg>

      <CanvasNode
        pos={layout.stocks}
        icon={<Boxes size={18} />}
        title="Stocks liés"
        sub={`${data.stocks.length} stock${data.stocks.length > 1 ? 's' : ''}`}
        alerte={data.stocks.some((s) => s.alerte)}
        onMove={(p) => moveNode('stocks', p)}
        onClick={() => setSelected({ kind: 'stocks' })}
        onDoubleClick={() => router.push('/stocks-liaisons')}
      />
      <CanvasNode
        pos={layout.activite}
        icon={<Factory size={18} />}
        title={data.activite.name}
        sub={`${data.activite.ficheCount} fiche${data.activite.ficheCount > 1 ? 's' : ''} active${data.activite.ficheCount > 1 ? 's' : ''}`}
        alerte={data.activite.alertesCount > 0}
        accent
        onMove={(p) => moveNode('activite', p)}
        onClick={() => setSelected({ kind: 'activite' })}
        onDoubleClick={() => router.push('/bom')}
      />
      <CanvasNode
        pos={layout.pos}
        icon={<Wallet size={18} />}
        title="Point de vente"
        sub={data.pos.productCount > 0 ? `${data.pos.productCount} produit(s) actifs` : 'Aucun produit actif'}
        dim={data.pos.productCount === 0}
        onMove={(p) => moveNode('pos', p)}
        onClick={() => setSelected({ kind: 'pos' })}
        onDoubleClick={() => router.push('/pos/caisse')}
      />
      <CanvasNode
        pos={layout.boutique}
        icon={<ShoppingBag size={18} />}
        title="Boutique en ligne"
        sub={data.boutique.productCount > 0 ? `${data.boutique.productCount} produit(s) actifs` : 'Aucun produit actif'}
        dim={data.boutique.productCount === 0}
        onMove={(p) => moveNode('boutique', p)}
        onClick={() => setSelected({ kind: 'boutique' })}
        onDoubleClick={() => router.push('/products')}
      />

      {selected && (
        <div className="absolute inset-y-0 right-0 w-[260px] border-l border-[var(--line-1)] bg-neutral-0 shadow-[var(--shadow-card)] flex flex-col overflow-auto z-10">
          <div className="px-3 py-2.5 border-b border-[var(--line-1)] flex items-center">
            <span className="text-erp-xs font-semibold text-choco-600 flex-1">Détail rapide</span>
            <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-choco-600 text-base leading-none">
              ×
            </button>
          </div>
          <div className="p-3 space-y-3">
            {selected.kind === 'stocks' && (
              <>
                {data.stocks.length === 0 ? (
                  <p className="text-erp-xs text-neutral-400 italic">Aucun stock lié.</p>
                ) : (
                  data.stocks.map((stock) => (
                    <StockRenameField
                      key={stock.id}
                      stock={stock}
                      onSave={(name) => renameStockMutation.mutate({ id: stock.id, name })}
                    />
                  ))
                )}
                <Btn variant="default" size="sm" onClick={() => router.push('/stocks-liaisons')} className="w-full justify-center">
                  Voir Stocks &amp; liaisons
                </Btn>
              </>
            )}

            {selected.kind === 'activite' && (
              <>
                <div className="flex gap-1.5 flex-wrap">
                  <Pill tone={data.activite.alertesCount > 0 ? 'crit' : 'ok'}>{data.activite.alertesCount} alerte(s)</Pill>
                  <Pill tone="gold">{data.activite.ficheCount} fiche(s)</Pill>
                </div>
                <RenameField label="Nom de l'activité" initial={data.activite.name} onSave={(name) => renameActiviteMutation.mutate(name)} />
                <Btn variant="primary" size="sm" onClick={() => router.push('/bom')} className="w-full justify-center">
                  Aller à Production
                </Btn>
              </>
            )}

            {selected.kind === 'pos' && (
              <>
                <p className="text-erp-xs text-neutral-600">
                  {data.pos.productCount} produit(s) publié(s), {data.pos.qtyTotal} unité(s) au total.
                </p>
                <Btn variant="primary" size="sm" onClick={() => router.push('/pos/caisse')} className="w-full justify-center">
                  Ouvrir la Caisse
                </Btn>
              </>
            )}

            {selected.kind === 'boutique' && (
              <>
                <p className="text-erp-xs text-neutral-600">
                  {data.boutique.productCount} produit(s) publié(s), {data.boutique.qtyTotal} unité(s) au total.
                </p>
                <Btn variant="primary" size="sm" onClick={() => router.push('/products')} className="w-full justify-center">
                  Ouvrir Produits
                </Btn>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CanvasNode({
  pos,
  icon,
  title,
  sub,
  alerte,
  dim,
  accent,
  onMove,
  onClick,
  onDoubleClick,
}: {
  pos: Position;
  icon: React.ReactNode;
  title: string;
  sub: string;
  alerte?: boolean;
  dim?: boolean;
  accent?: boolean;
  onMove: (pos: Position) => void;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    if (d.moved) onMove({ x: d.origX + dx, y: d.origY + dy });
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const handleClick = () => {
    if (dragRef.current?.moved) {
      dragRef.current = null;
      return;
    }
    dragRef.current = null;
    onClick();
  };

  return (
    <div
      style={{ position: 'absolute', left: pos.x, top: pos.y, width: NODE_SIZE.w }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      className={`select-none cursor-grab active:cursor-grabbing p-3 rounded-[var(--rx-card)] border shadow-[var(--shadow-card)] bg-neutral-0 transition-opacity ${
        accent ? 'border-choco-600' : 'border-[var(--line-1)]'
      } ${dim ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2 text-choco-600">
        {icon}
        <span className="text-erp-xs font-semibold line-clamp-1">{title}</span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10.5px] text-neutral-500">{sub}</span>
        {alerte && <Pill tone="crit">alerte</Pill>}
      </div>
    </div>
  );
}

function RenameField({ label, initial, onSave }: { label: string; initial: string; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="space-y-1">
      {label && <label className="block text-[10.5px] font-medium text-choco-600">{label}</label>}
      <div className="flex gap-1.5">
        <input value={value} onChange={(e) => setValue(e.target.value)} className="form-input flex-1 text-erp-xs" />
        <Btn variant="default" size="sm" onClick={() => onSave(value)} disabled={!value.trim() || value === initial}>
          OK
        </Btn>
      </div>
    </div>
  );
}

function StockRenameField({ stock, onSave }: { stock: FlowStock; onSave: (name: string) => void }) {
  return (
    <div className="pb-2.5 border-b border-[var(--line-1)] last:border-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10.5px] text-neutral-500 flex-1">Stock</span>
        {stock.alerte && <Pill tone="crit">alerte</Pill>}
      </div>
      <RenameField label="" initial={stock.name} onSave={onSave} />
    </div>
  );
}
