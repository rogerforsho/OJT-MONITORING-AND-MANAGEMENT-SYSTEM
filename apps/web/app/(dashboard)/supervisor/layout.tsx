import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect('/auth/sign-in');

  if (!['Supervisor', 'Admin'].includes(user.role) || user.account_status !== 'active') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
