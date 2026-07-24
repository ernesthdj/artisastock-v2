import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from 'sonner';

async function getTenantConfig(tenantSlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/storefront/${tenantSlug}/config`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: { params: Promise<{ tenantSlug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const data = await getTenantConfig(params.tenantSlug);
  if (!data) return { title: 'Boutique introuvable' };

  return {
    title: {
      default: data.tenant.name,
      template: `%s | ${data.tenant.name}`,
    },
    description: data.tenant.description ?? undefined,
  };
}

export default async function StorefrontLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ tenantSlug: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const data = await getTenantConfig(params.tenantSlug);
  if (!data || !data.config?.isPublished) notFound();

  return (
    <QueryProvider>
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
        <StorefrontHeader tenant={data.tenant} pages={data.pages ?? []} tenantSlug={params.tenantSlug} />
        <main className="flex-1">{children}</main>
        <StorefrontFooter tenant={data.tenant} />
        <Toaster position="top-center" />
      </div>
    </QueryProvider>
  );
}
