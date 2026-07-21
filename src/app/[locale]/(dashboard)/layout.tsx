'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppTitleBar } from '@/components/layout/AppTitleBar';
import { AppStatusBar } from '@/components/layout/AppStatusBar';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [user, isLoading, router, locale]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F1' }}>
        <Loader2 style={{ color: '#6F4E37' }} size={28} className="animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F1', display: 'flex', flexDirection: 'row' }}>
      {/* TitleBar fixed at top */}
      <AppTitleBar />

      {/*
        AppSidebar renders:
          - a fixed <aside> (visual sidebar, out of flow)
          - a spacer <div> (same width, IN flow as flex child) — pushes main right
      */}
      <AppSidebar />

      {/* Main content — flex:1, offset top for TitleBar, bottom for StatusBar */}
      <main style={{ flex: 1, minWidth: 0, paddingTop: 40, paddingBottom: 25, minHeight: '100vh' }}>
        <div style={{ padding: '24px 32px' }}>
          {children}
        </div>
      </main>

      <AppStatusBar />
    </div>
  );
}
