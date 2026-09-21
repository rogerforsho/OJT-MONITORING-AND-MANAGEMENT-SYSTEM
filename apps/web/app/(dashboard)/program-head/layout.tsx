import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@/src/services/auth';

export const metadata: Metadata = {
  title: 'Program Head Portal',
};

export default async function ProgramHeadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect('/auth/sign-in');

  if (!['ProgramHead', 'Admin', 'Coordinator'].includes(user.role) || user.account_status !== 'active') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
