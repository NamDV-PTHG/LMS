'use client';

import { useEffect } from 'react';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import { WebShell } from '../../../components/web/web-shell';

function FaviconInjector() {
  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => r.json())
      .then((res) => {
        const url = res.data?.faviconUrl;
        if (!url) return;
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = url;
      })
      .catch(() => {});
  }, []);
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <FaviconInjector />
        <WebShell>{children}</WebShell>
      </ToastProvider>
    </AuthProvider>
  );
}
