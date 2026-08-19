import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import Sidebar from '@/src/components/layout/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  if (!user) redirect('/auth/sign-in');
  if (user.account_status === 'pending') redirect('/auth/pending');
  if (user.account_status !== 'active') redirect('/auth/sign-in');

  return (
    <div className="flex h-screen bg-[#F4F6F9] overflow-hidden">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto page-fade-in">
        {children}
      </main>
    </div>
  );
}
