'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@ojt/shared';
import { signOut } from '@/src/services/auth';

const NAV_ITEMS: Record<string, { label: string; href: string; icon: string }[]> = {
  Student: [
    { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
    { label: 'Attendance', href: '/student/attendance', icon: '📋' },
    { label: 'Progress', href: '/student/progress', icon: '📈' },
    { label: 'Reports', href: '/student/reports', icon: '📁' },
    { label: 'Notifications', href: '/student/notifications', icon: '🔔' },
  ],
  Coordinator: [
    { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
    { label: 'Approvals', href: '/coordinator/approvals', icon: '✅' },
    { label: 'Students', href: '/coordinator/students', icon: '👥' },
    { label: 'Companies', href: '/coordinator/companies', icon: '🏢' },
    { label: 'Assignments', href: '/coordinator/assignments', icon: '🔗' },
    { label: 'Submissions', href: '/coordinator/submissions', icon: '📁' },
    { label: 'Progress', href: '/coordinator/progress', icon: '📈' },
  ],
  Supervisor: [
    { label: 'My Students', href: '/supervisor/students', icon: '👥' },
    { label: 'Attendance', href: '/supervisor/attendance', icon: '📋' },
    { label: 'Evaluations', href: '/supervisor/evaluations', icon: '⭐' },
  ],
  ProgramHead: [
    { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
    { label: 'Reports', href: '/program-head/reports', icon: '📊' },
  ],
  Admin: [
    { label: 'Administration', href: '/admin', icon: '⚙️' },
  ],
};

interface Props {
  user: AuthUser;
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const items = NAV_ITEMS[user.role] ?? [];

  return (
    <aside className="w-60 bg-teal-950 flex flex-col h-full shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-teal-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-sm">
            🎓
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">OJT System</p>
            <p className="text-teal-400/60 text-xs">Colegio de Montalban</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-5 py-4 border-b border-teal-800/50">
        <p className="text-white text-sm font-medium truncate">{user.full_name}</p>
        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
          {user.role}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${active
                  ? 'bg-teal-600/30 text-white border border-teal-500/30'
                  : 'text-teal-300/70 hover:bg-teal-800/40 hover:text-white'
                }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-teal-800/50">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-teal-300/70 hover:bg-teal-800/40 hover:text-white transition-all"
          >
            <span className="text-base leading-none">→</span>
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
