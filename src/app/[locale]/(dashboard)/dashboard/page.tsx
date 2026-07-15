'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/AuthProvider';
import { formatPrice } from '@/lib/utils/format';
import { ShoppingCart, TrendingUp, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';

interface KpiData {
  ordersToday: number;
  revenueToday: number;
  revenueMonth: number;
  stockAlerts: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalTTC: number;
    customer: { firstName: string; lastName: string };
    createdAt: string;
  }>;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouvelle',
  CONFIRMED: 'Confirmée',
  IN_PREPARATION: 'En préparation',
  READY: 'Prête',
  PICKED_UP: 'Retirée',
  CANCELLED: 'Annulée',
};

const ORDER_STATUS_STYLES: Record<string, React.CSSProperties> = {
  NEW:            { background: '#DBEAFE', color: '#1E40AF' },
  CONFIRMED:      { background: '#D1FAE5', color: '#065F46' },
  IN_PREPARATION: { background: '#FFF9E4', color: '#7D6608' },
  READY:          { background: '#EAD9C8', color: '#3D2817' },
  PICKED_UP:      { background: '#ECE9D8', color: '#55524E' },
  CANCELLED:      { background: '#FFE4E4', color: '#9A1F37' },
};

// KPI tile
function KpiTile({
  label, value, sub, icon: Icon, tone = 'default', onClick,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; tone?: 'default' | 'gold' | 'danger' | 'ok' | 'info';
  onClick?: () => void;
}) {
  const tones = {
    default: { icon: '#9E7B5C', iconBg: '#F5EFE6' },
    gold:    { icon: '#7D6608', iconBg: '#FFF9E4' },
    danger:  { icon: '#C72C48', iconBg: '#FFE4E4' },
    ok:      { icon: '#1B7A3E', iconBg: '#D1FAE5' },
    info:    { icon: '#316AC5', iconBg: '#DBEAFE' },
  };
  const t = tones[tone];

  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        border: '1px solid #ECE9D8',
        borderRadius: 6,
        padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(61,40,23,0.05)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(61,40,23,0.10)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(61,40,23,0.05)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 12, color: '#807865', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>{label}</p>
        <div style={{
          width: 30, height: 30, borderRadius: 6,
          background: t.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} style={{ color: t.icon }} />
        </div>
      </div>
      <p style={{
        fontSize: 28, fontWeight: 700, color: '#3D2817', margin: '0 0 2px 0', lineHeight: 1,
        fontFamily: 'Inter, sans-serif',
      }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#9E7B5C', margin: 0 }}>{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: kpi, isLoading } = useQuery({
    queryKey: ['dashboard-kpi'],
    queryFn: async () => {
      const res = await apiClient.get<KpiData>('/api/v1/dashboard/kpi');
      return res.data;
    },
  });

  const { data: stockAlerts } = useQuery({
    queryKey: ['dashboard-stock-alerts'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{
        id: string; name: string; stockQuantity: number; alertThreshold: number; unit: string;
      }>>('/api/v1/dashboard/stock-alerts');
      return res.data;
    },
  });

  const today = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 28, fontWeight: 700, color: '#3D2817',
          margin: '0 0 2px 0', letterSpacing: '-0.01em',
        }}>
          Bonjour{user?.firstName ? `, ${user.firstName}` : ''} 👋
        </h1>
        <p style={{ fontSize: 12.5, color: '#807865', margin: 0, textTransform: 'capitalize' }}>
          {today}
        </p>
      </div>

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 20,
      }}>
        <KpiTile
          label="Commandes aujourd'hui"
          value={isLoading ? '—' : (kpi?.ordersToday ?? 0)}
          icon={ShoppingCart}
          tone="default"
          onClick={() => router.push('/orders')}
        />
        <KpiTile
          label="CA du jour"
          value={isLoading ? '—' : formatPrice(kpi?.revenueToday ?? 0)}
          icon={TrendingUp}
          tone="ok"
        />
        <KpiTile
          label="CA du mois"
          value={isLoading ? '—' : formatPrice(kpi?.revenueMonth ?? 0)}
          icon={TrendingUp}
          tone="info"
        />
        <KpiTile
          label="Alertes stock"
          value={isLoading ? '—' : (kpi?.stockAlerts ?? 0)}
          sub={(kpi?.stockAlerts ?? 0) > 0 ? 'à traiter' : 'tout est OK'}
          icon={AlertTriangle}
          tone={(kpi?.stockAlerts ?? 0) > 0 ? 'danger' : 'ok'}
          onClick={() => router.push('/ingredients')}
        />
      </div>

      {/* Two-column: orders + alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>

        {/* Recent orders */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #ECE9D8',
          borderRadius: 6,
          boxShadow: '0 1px 2px rgba(61,40,23,0.04)',
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #ECE9D8',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#3D2817' }}>Dernières commandes</span>
            <Link href="/orders" style={{ fontSize: 12, color: '#9E7B5C', fontWeight: 600, textDecoration: 'none' }}>
              Voir toutes →
            </Link>
          </div>

          {isLoading ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: 40, background: '#F5EFE6', borderRadius: 4 }} className="animate-skeleton" />
              ))}
            </div>
          ) : !kpi?.recentOrders?.length ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <ShoppingCart size={36} style={{ color: '#D4C4B4', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, color: '#807865', margin: '0 0 4px 0' }}>Aucune commande pour le moment</p>
              <p style={{ fontSize: 12, color: '#ACA899', margin: 0 }}>Les commandes de votre vitrine apparaîtront ici</p>
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 130px 90px',
                padding: '6px 16px',
                background: '#F5EFE6',
                borderBottom: '1px solid #ECE9D8',
              }}>
                {['Référence', 'Client', 'Statut', 'Montant'].map(h => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 600, color: '#9E7B5C', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {h}
                  </span>
                ))}
              </div>

              {kpi.recentOrders.map((order, i) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  style={{
                    display: 'grid', gridTemplateColumns: '110px 1fr 130px 90px',
                    padding: '9px 16px', alignItems: 'center',
                    borderBottom: i < kpi.recentOrders.length - 1 ? '1px solid #F0EBE0' : 'none',
                    textDecoration: 'none',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F5EFE6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontFamily: 'SFMono-Regular, Menlo, monospace', fontSize: 11.5, color: '#6F4E37', fontWeight: 600 }}>
                    {order.orderNumber}
                  </span>
                  <span style={{ fontSize: 12.5, color: '#3D2817', fontWeight: 500, paddingRight: 8 }}>
                    {order.customer.firstName} {order.customer.lastName}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 8px', borderRadius: 999,
                    fontSize: 11, fontWeight: 600,
                    width: 'fit-content',
                    ...(ORDER_STATUS_STYLES[order.status] ?? { background: '#ECE9D8', color: '#55524E' }),
                  }}>
                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#3D2817', textAlign: 'right' }}>
                    {formatPrice(order.totalTTC)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stock alerts */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #ECE9D8',
          borderRadius: 6,
          boxShadow: '0 1px 2px rgba(61,40,23,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #ECE9D8',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#3D2817' }}>Alertes stock</span>
            <Link href="/ingredients" style={{ fontSize: 12, color: '#9E7B5C', fontWeight: 600, textDecoration: 'none' }}>
              Voir tout →
            </Link>
          </div>

          {!stockAlerts?.length ? (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <CheckCircle2 size={36} style={{ color: '#27AE60', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, color: '#3D2817', fontWeight: 600, margin: '0 0 2px 0' }}>Tout est OK</p>
              <p style={{ fontSize: 12, color: '#9E7B5C', margin: 0 }}>Aucune alerte stock en ce moment</p>
            </div>
          ) : (
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stockAlerts.slice(0, 8).map((alert) => (
                <Link
                  key={alert.id}
                  href="/ingredients"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 5,
                    background: '#FFF9E4',
                    border: '1px solid #FFE580',
                    textDecoration: 'none',
                    transition: 'border-color .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#D4AF37')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#FFE580')}
                >
                  <AlertTriangle size={14} style={{ color: '#C77A28', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: '#3D2817', margin: '0 0 1px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#C77A28', margin: 0 }}>
                      {alert.stockQuantity} {alert.unit} · seuil {alert.alertThreshold}
                    </p>
                  </div>
                  <Package size={12} style={{ color: '#ACA899', flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
