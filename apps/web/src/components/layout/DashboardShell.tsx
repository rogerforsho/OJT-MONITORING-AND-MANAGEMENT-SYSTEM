'use client';

import React, { useState } from 'react';
import type { AuthUser } from '@ojt/shared';
import Sidebar from '@/src/components/layout/Sidebar';
import Navbar from '@/src/components/layout/Navbar';
import MiniWidgetView from '@/src/components/desktop/MiniWidgetView';
import IdleSessionGuard from '@/src/components/auth/IdleSessionGuard';

interface Props {
  user: AuthUser;
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors">
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Navbar
          user={user}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 overflow-y-auto page-fade-in focus:outline-none">
          {children}
        </main>
      </div>

      {/* Floating WFH Mini-Widget Mode (if active) */}
      <MiniWidgetView user={user} />

      {/* 15-Minute Idle Inactivity Lockout Guard (ISO/IEC 25010:2023) */}
      <IdleSessionGuard user={user} />
    </div>
  );
}
