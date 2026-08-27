'use client';

import React from 'react';
import type { AuthUser } from '@ojt/shared';
import Sidebar from '@/src/components/layout/Sidebar';
import MiniWidgetView from '@/src/components/desktop/MiniWidgetView';

interface Props {
  user: AuthUser;
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: Props) {
  return (
    <div className="flex h-screen bg-[#F4F6F9] overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto page-fade-in">
        {children}
      </main>

      {/* Floating WFH Mini-Widget Mode (if active) */}
      <MiniWidgetView user={user} />
    </div>
  );
}
