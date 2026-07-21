import { Empty, Pill } from '@/components/ui';

export default function FournisseursPage() {
  return (
    <Empty
      icon="🚚"
      title="Fournisseurs"
      desc="Centralisez vos contacts fournisseurs, tarifs et conditions de livraison. Le module Fournisseurs est en cours de construction."
      action={<Pill tone="gold">🚧 En développement</Pill>}
    />
  );
}
