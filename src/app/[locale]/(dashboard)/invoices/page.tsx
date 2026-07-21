import { Empty, Pill } from '@/components/ui';

export default function FacturationPage() {
  return (
    <Empty
      icon="🧾"
      title="Facturation"
      desc="Émettez et suivez vos factures clients en toute simplicité. Le module Facturation est en cours de construction."
      action={<Pill tone="gold">🚧 En développement</Pill>}
    />
  );
}
