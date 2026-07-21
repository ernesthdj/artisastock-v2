import { Empty, Pill } from '@/components/ui';

export default function RecettesPage() {
  return (
    <Empty
      icon="👨‍🍳"
      title="Recettes"
      desc="Gérez vos fiches recettes, coûts de production et nomenclatures. Le module Recettes est en cours de construction."
      action={<Pill tone="gold">🚧 En développement</Pill>}
    />
  );
}
