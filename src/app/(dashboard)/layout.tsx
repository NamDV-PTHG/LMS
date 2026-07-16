'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import { WebShell } from '../../../components/web/web-shell';

/**
 * Injects company-specific favicon and browser tab title.
 * - Favicon: uses /api/public/branding (no auth needed)
 * - Title: fetched once on auth, re-applied on every route change to override
 *   Next.js App Router resetting document.title from static metadata.
 */
function BrandingInjector() {
  const { accessToken } = useAuth();
  const pathname = usePathname();
  const [siteTitle, setSiteTitle] = useState<string | null>(null);

  // Favicon — public, runs once on mount
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

  // Fetch siteTitle once when auth token is available
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/me/company', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((res) => {
        const title = res.data?.siteTitle;
        if (title) setSiteTitle(title);
      })
      .catch(() => {});
  }, [accessToken]);

  // Re-apply title on every route change (Next.js resets it from static metadata)
  useEffect(() => {
    if (siteTitle) document.title = siteTitle;
  }, [siteTitle, pathname]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrandingInjector />
        <WebShell>{children}</WebShell>
      </ToastProvider>
    </AuthProvider>
  );
}
