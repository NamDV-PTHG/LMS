'use client';

import { Sidebar } from './sidebar';

export function WebShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}
