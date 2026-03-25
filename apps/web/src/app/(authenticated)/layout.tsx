'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/topbar';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <Sidebar />
      <TopBar />
      <main className="ml-[var(--sidebar-width)] mt-[var(--topbar-height)]">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
