'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@ojt/shared';
import SignOutButton from '@/src/components/layout/SignOutButton';
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
  type IconProps,
} from '@/src/components/ui/Icons';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  Student: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/student/attendance', icon: Clock },
    { label: 'Progress', href: '/student/progress', icon: BarChart3 },
    { label: 'Reports', href: '/student/reports', icon: FileText },
    { label: 'Certificate', href: '/student/certificate', icon: Award },
    { label: 'Notifications', href: '/student/notifications', icon: Bell },
  ],
  Coordinator: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Approvals', href: '/coordinator/approvals', icon: UserCheck },
    { label: 'Students', href: '/coordinator/students', icon: Users },
    { label: 'Companies', href: '/coordinator/companies', icon: Building2 },
    { label: 'Supervisors', href: '/coordinator/supervisors', icon: UserCheck },
    { label: 'Assignments', href: '/coordinator/assignments', icon: FileSignature },
    { label: 'Submissions', href: '/coordinator/submissions', icon: ClipboardCheck },
    { label: 'Progress', href: '/coordinator/progress', icon: BarChart3 },
  ],
  Supervisor: [
    { label: 'My Students', href: '/supervisor/students', icon: Users },
    { label: 'Attendance', href: '/supervisor/attendance', icon: Clock },
    { label: 'Evaluations', href: '/supervisor/evaluations', icon: Star },
  ],
  ProgramHead: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Reports', href: '/program-head/reports', icon: BarChart3 },
  ],
  Admin: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Administration', href: '/admin', icon: Settings },
  ],
};

const ROLE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  Student: { bg: 'bg-[#FFCC00]/15', text: 'text-[#FFCC00]', border: 'border-[#FFCC00]/40' },
  Coordinator: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  Supervisor: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
  ProgramHead: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40' },
  Admin: { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40' },
};

interface Props {
  user: AuthUser;
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const { isDesktop, toggleMiniWidget } = useDesktop();
  const items = NAV_ITEMS[user.role] ?? [];
  const badge = ROLE_BADGES[user.role] ?? ROLE_BADGES.Student;

  return (
    <aside className="w-64 bg-[#062415] border-r border-[#FFCC00]/20 flex flex-col h-full shrink-0 select-none shadow-2xl">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3 bg-gradient-to-b from-black/25 to-transparent">
        <div className="w-10 h-10 rounded-xl bg-white/10 p-1.5 flex items-center justify-center border border-[#FFCC00]/30 shadow-inner flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Colegio de Montalban Seal"
            width={32}
            height={32}
            className="object-contain"
            priority
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-black text-white leading-tight font-serif tracking-tight">
            Colegio de Montalban
          </h2>
          <p className="text-[10px] font-extrabold text-[#FFCC00] tracking-widest uppercase mt-0.5">
            OJT Practicum System
          </p>
        </div>
      </div>

      {/* User Role Card */}
      <div className="px-3.5 py-2.5 mx-3 my-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#0A3D24] text-[#FFCC00] border border-[#FFCC00]/30 flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0">
          {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate leading-tight">{user.full_name}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badge.bg} ${badge.text} ${badge.border}`}>
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const IconComponent = item.icon;
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                active
                  ? 'bg-[#0A3D24] text-[#FFCC00] shadow-md border border-[#FFCC00]/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <IconComponent className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#FFCC00]' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Native Indicator (shown only when running on Desktop) */}
      {isDesktop && (
        <div className="px-3 py-2 mx-3 mb-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
              Desktop Mode
            </span>
          </div>
          <button
            type="button"
            onClick={() => toggleMiniWidget(true)}
            title="Toggle Floating Mini-Widget Mode"
            className="text-[10px] font-extrabold text-[#FFCC00] hover:text-white px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            Widget
          </button>
        </div>
      )}

      {/* Universal Account Settings Link */}
      <div className="px-3 pb-2">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
            pathname === '/settings'
              ? 'bg-[#0A3D24] text-[#FFCC00] shadow-md border border-[#FFCC00]/30'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings className={`w-4 h-4 flex-shrink-0 ${pathname === '/settings' ? 'text-[#FFCC00]' : 'text-slate-400'}`} />
          <span className="truncate">Account Settings</span>
        </Link>
      </div>

      {/* Sign Out Action & Micro-Status Badge */}
      <div className="p-3 border-t border-white/10 bg-black/20 space-y-2.5">
        <SignOutButton />

        {/* System Version & Legal Compliance Footnote */}
        <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-300">v1.2.0 &bull; Online</span>
          </div>
          <span className="text-[9px] text-slate-400 font-medium">RA 10173 &bull; ISO/IEC</span>
        </div>
      </div>
    </aside>
  );
}
