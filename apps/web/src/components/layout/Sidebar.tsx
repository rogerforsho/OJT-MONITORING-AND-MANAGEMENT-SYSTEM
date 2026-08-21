'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@ojt/shared';
import { signOut } from '@/src/services/auth';

const NAV_ITEMS: Record<string, { label: string; href: string; icon: string }[]> = {
  Student: [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Attendance', href: '/student/attendance', icon: '📅' },
    { label: 'Progress', href: '/student/progress', icon: '📈' },
    { label: 'Reports', href: '/student/reports', icon: '📝' },
    { label: 'Notifications', href: '/student/notifications', icon: '🔔' },
  ],
  Coordinator: [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Approvals', href: '/coordinator/approvals', icon: '✓' },
    { label: 'Students', href: '/coordinator/students', icon: '👥' },
    { label: 'Companies', href: '/coordinator/companies', icon: '🏢' },
    { label: 'Supervisors', href: '/coordinator/supervisors', icon: '👔' },
    { label: 'Assignments', href: '/coordinator/assignments', icon: '📋' },
    { label: 'Submissions', href: '/coordinator/submissions', icon: '📑' },
    { label: 'Progress', href: '/coordinator/progress', icon: '📈' },
  ],
  Supervisor: [
    { label: 'My Students', href: '/supervisor/students', icon: '👥' },
    { label: 'Attendance', href: '/supervisor/attendance', icon: '📅' },
    { label: 'Evaluations', href: '/supervisor/evaluations', icon: '⭐' },
  ],
  ProgramHead: [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Reports', href: '/program-head/reports', icon: '📄' },
  ],
  Admin: [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Administration', href: '/admin', icon: '⚙️' },
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
  const items = NAV_ITEMS[user.role] ?? [];
  const badge = ROLE_BADGES[user.role] ?? ROLE_BADGES.Student;

  return (
    <aside className="w-64 bg-[#062415] border-r border-[#FFCC00]/20 flex flex-col h-full shrink-0 select-none shadow-2xl">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-[#0A3D24]/80 bg-[#041a0f]/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white p-0.5 border-1.5 border-[#FFCC00] shadow-md flex items-center justify-center shrink-0 overflow-hidden">
            <Image
              src="/logo.png"
              alt="Colegio de Montalban Seal"
              width={38}
              height={38}
              className="w-full h-full object-contain rounded-full"
              priority
            />
          </div>
          <div className="overflow-hidden">
            <p className="text-[#FFCC00] text-xs font-black tracking-wider uppercase font-serif truncate">
              CdM OJT Portal
            </p>
            <p className="text-slate-300 text-[11px] font-medium truncate">
              Colegio de Montalban
            </p>
          </div>
        </div>
      </div>

      {/* User info card */}
      <div className="px-5 py-3.5 border-b border-[#0A3D24]/60 bg-[#062415]">
        {user.role === 'Admin' ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className={`inline-block text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
              ADMIN
            </span>
          </div>
        ) : (
          <>
            <p className="text-white text-sm font-bold truncate leading-snug">{user.full_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                {user.role}
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate">
                {user.role === 'Student' ? '4th-Year ICS/IBE' : 'Faculty / Staff'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all
                ${active
                  ? 'bg-[#0A3D24] text-[#FFCC00] border border-[#FFCC00]/40 shadow-sm shadow-black/20'
                  : 'text-slate-300 hover:bg-[#0A3D24]/50 hover:text-white'
                }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out Action */}
      <div className="px-3 py-3.5 border-t border-[#0A3D24]/80 bg-[#041a0f]/40">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/30 border border-rose-900/50 hover:bg-rose-900/40 hover:text-white transition-all cursor-pointer shadow-sm"
          >
            <span className="text-sm">🚪</span>
            Sign Out of Portal
          </button>
        </form>
      </div>
    </aside>
  );
}
