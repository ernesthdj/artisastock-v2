import { Empty, Pill } from '@/components/ui';

export default function ProduitsPage() {
  return (
    <Empty
      icon="🛍️"
      title="Produits"
      desc="Configurez votre catalogue produits, prix de vente et disponibilités. Le module Produits est en cours de construction."
      action={<Pill tone="gold">🚧 En développement</Pill>}
    />
  );
}
