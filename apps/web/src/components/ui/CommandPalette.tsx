'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@ojt/shared';
import { signOut } from '@/src/services/auth';
import { useDesktop } from '@/src/hooks/useDesktop';
import {
  LayoutDashboard,
  Clock,
  BarChart3,
  FileText,
  Award,
  Bell,
  UserCheck,
  Users,
  Building2,
  FileSignature,
  ClipboardCheck,
  Star,
  Settings,
  LogOut,
  X,
} from '@/src/components/ui/Icons';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Desktop';
  icon: any;
  shortcut?: string;
  action: () => void;
  keywords?: string;
}

interface Props {
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ user, isOpen, onClose }: Props) {
  const router = useRouter();
  const { isDesktop, toggleMiniWidget, minimizeToTray } = useDesktop();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build command list based on user role
  const commands: CommandItem[] = [
    // Core Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      category: 'Navigation',
      icon: LayoutDashboard,
      keywords: 'home overview metrics stats',
      action: () => router.push('/dashboard'),
    },
  ];

  if (user.role === 'Student') {
    commands.push(
      {
        id: 'nav-attendance',
        title: 'Attendance & Daily Logs',
        category: 'Navigation',
        icon: Clock,
        keywords: 'clock in time out selfie DTR hours',
        action: () => router.push('/student/attendance'),
      },
      {
        id: 'nav-progress',
        title: 'Internship Progress',
        category: 'Navigation',
        icon: BarChart3,
        keywords: 'rendered remaining hours target status',
        action: () => router.push('/student/progress'),
      },
      {
        id: 'nav-reports',
        title: 'Digital Reports & Requirements',
        category: 'Navigation',
        icon: FileText,
        keywords: 'submission weekly journal endorsement',
        action: () => router.push('/student/reports'),
      },
      {
        id: 'nav-certificate',
        title: 'Completion Certificate',
        category: 'Navigation',
        icon: Award,
        keywords: 'diploma certificate verify graduation',
        action: () => router.push('/student/certificate'),
      }
    );
  }

  if (user.role === 'Coordinator') {
    commands.push(
      {
        id: 'nav-approvals',
        title: 'Student Registration Approvals',
        category: 'Navigation',
        icon: UserCheck,
        keywords: 'pending verify register queue trainees',
        action: () => router.push('/coordinator/approvals'),
      },
      {
        id: 'nav-students',
        title: 'Trainees Directory',
        category: 'Navigation',
        icon: Users,
        keywords: 'all students list batch filter ICS IBE',
        action: () => router.push('/coordinator/students'),
      },
      {
        id: 'nav-companies',
        title: 'Partner Establishments (HTEs)',
        category: 'Navigation',
        icon: Building2,
        keywords: 'companies moa host training industry',
        action: () => router.push('/coordinator/companies'),
      },
      {
        id: 'nav-submissions',
        title: 'Report Submissions Queue',
        category: 'Navigation',
        icon: ClipboardCheck,
        keywords: 'grade review accept reject documents',
        action: () => router.push('/coordinator/submissions'),
      }
    );
  }

  if (user.role === 'Admin') {
    commands.push(
      {
        id: 'nav-admin',
        title: 'System Administration & User Management',
        category: 'Navigation',
        icon: Settings,
        keywords: 'manage users delete accounts audit logs staff',
        action: () => router.push('/admin'),
      }
    );
  }

  // Desktop Superpower Actions
  if (isDesktop) {
    commands.push(
      {
        id: 'desktop-widget',
        title: 'Toggle Floating Shift Stopwatch Widget',
        category: 'Desktop',
        icon: Clock,
        shortcut: 'Ctrl+M',
        keywords: 'mini widget companion always on top float',
        action: () => toggleMiniWidget(true),
      },
      {
        id: 'desktop-tray',
        title: 'Minimize to System Tray',
        category: 'Desktop',
        icon: Bell,
        keywords: 'background hide taskbar clock',
        action: () => minimizeToTray(),
      }
    );
  }

  // Common Actions
  commands.push(
    {
      id: 'action-signout',
      title: 'Sign Out Account',
      category: 'Actions',
      icon: LogOut,
      keywords: 'logout exit lock switch',
      action: () => signOut(),
    }
  );

  // Filter commands
  const filtered = commands.filter((c) => {
    const term = query.toLowerCase().trim();
    if (!term) return true;
    return (
      c.title.toLowerCase().includes(term) ||
      c.category.toLowerCase().includes(term) ||
      (c.keywords && c.keywords.toLowerCase().includes(term))
    );
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 page-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-slate-900 border border-[#FFCC00]/40 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center gap-3 bg-black/30">
          <svg className="w-5 h-5 text-[#FFCC00] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page, or action..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none"
          />
          <kbd className="text-[10px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-slate-300 border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Command Results */}
        <div className="p-2 overflow-y-auto space-y-1 flex-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No matching commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const IconComp = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-[#0A3D24] text-[#FFCC00] border border-[#FFCC00]/40 shadow-sm'
                      : 'text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#FFCC00]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <kbd className="text-[9px] font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded text-[#FFCC00]">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-white/10 bg-black/40 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <span>Navigate: <kbd className="font-mono bg-white/10 px-1 rounded">↑</kbd> <kbd className="font-mono bg-white/10 px-1 rounded">↓</kbd></span>
            <span>Select: <kbd className="font-mono bg-white/10 px-1 rounded">↵</kbd></span>
          </div>
          <span>Colegio de Montalban OJT System</span>
        </div>
      </div>
    </div>
  );
}
