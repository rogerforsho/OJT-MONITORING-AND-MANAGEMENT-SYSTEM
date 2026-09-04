import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';
import DashboardShell from '@/src/components/layout/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  if (!user) redirect('/auth/sign-in');
  if (user.account_status === 'pending') redirect('/auth/pending');
  if (user.account_status !== 'active') redirect('/auth/sign-in');

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  );
}
