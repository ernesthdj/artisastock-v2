import { Empty, Pill } from '@/components/ui';

export default function CMSBuilderPage() {
  return (
    <Empty
      icon="🎨"
      title="CMS Builder"
      desc="Personnalisez votre vitrine en ligne — bannières, pages et mise en avant. Le module CMS Builder est en cours de construction."
      action={<Pill tone="gold">🚧 En développement</Pill>}
    />
  );
}
