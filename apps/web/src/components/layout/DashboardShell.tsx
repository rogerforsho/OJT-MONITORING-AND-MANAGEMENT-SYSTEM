'use client';

import React, { useState, useEffect } from 'react';
import type { AuthUser } from '@ojt/shared';
import Sidebar from '@/src/components/layout/Sidebar';
import DesktopTitlebar from '@/src/components/layout/DesktopTitlebar';
import CommandPalette from '@/src/components/ui/CommandPalette';
import MiniWidgetView from '@/src/components/desktop/MiniWidgetView';
import { useDesktop } from '@/src/hooks/useDesktop';

interface Props {
  user: AuthUser;
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: Props) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const { isDesktop, toggleMiniWidget, isMiniWidget } = useDesktop();

  // Global Keyboard Shortcuts (Ctrl+K for Command Palette, Ctrl+M for Mini-Widget)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K or Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      // Ctrl + M or Cmd + M (Toggle Mini-Widget if Desktop)
      if (isDesktop && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMiniWidget(!isMiniWidget);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop, isMiniWidget, toggleMiniWidget]);

  return (
    <div className="flex flex-col h-screen bg-[#F4F6F9] overflow-hidden">
      {/* Desktop Native Titlebar */}
      <DesktopTitlebar onOpenCommandPalette={() => setCmdOpen(true)} />

      {/* Main App Content & Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto page-fade-in">
          {children}
        </main>
      </div>

      {/* Global Command Palette Overlay */}
      <CommandPalette
        user={user}
        isOpen={cmdOpen}
        onClose={() => setCmdOpen(false)}
      />

      {/* Floating WFH Mini-Widget Mode */}
      <MiniWidgetView user={user} />
    </div>
  );
}
