import { Empty, Pill } from '@/components/ui';

export default function ParamtresPage() {
  return (
    <Empty
      icon="⚙️"
      title="Paramètres"
      desc="Configurez votre espace artisan, facturation, notifications et intégrations. Le module Paramètres est en cours de construction."
      action={<Pill tone="gold">🚧 En développement</Pill>}
    />
  );
}
